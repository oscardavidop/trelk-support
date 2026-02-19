/**
 * Playbook Service — Business logic for playbooks & progress tracking
 */

import {
  Playbook, type IPlaybook, type IPlaybookStep,
  PlaybookProgress, type IPlaybookProgress, type IStepProgress, type StepStatus,
} from '../database/index.js';
import type { Types } from 'mongoose';

// ─── PLAYBOOK CRUD ──────────────────────────────────────────

export async function getAllPlaybooks(filter: { isActive?: boolean; category?: string } = {}) {
  const query: Record<string, any> = {};
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  if (filter.category) query.category = filter.category;
  return Playbook.find(query).sort({ category: 1, name: 1 }).populate('createdBy', 'name email').lean();
}

export async function getPlaybookById(id: string) {
  return Playbook.findById(id).populate('createdBy', 'name email').populate('updatedBy', 'name email').lean();
}

export async function createPlaybook(data: Partial<IPlaybook>, agentId: string) {
  const playbook = new Playbook({
    ...data,
    createdBy: agentId,
    version: 1,
  });
  return playbook.save();
}

export async function updatePlaybook(id: string, data: Partial<IPlaybook>, agentId: string) {
  const playbook = await Playbook.findById(id);
  if (!playbook) return null;

  // Increment version on step changes
  const stepsChanged = data.steps && JSON.stringify(data.steps) !== JSON.stringify(playbook.steps);
  
  const update: Record<string, any> = {
    ...data,
    updatedBy: agentId,
  };
  if (stepsChanged) {
    update.version = playbook.version + 1;
  }

  return Playbook.findByIdAndUpdate(id, update, { new: true }).lean();
}

export async function deletePlaybook(id: string) {
  const result = await Playbook.findByIdAndDelete(id);
  if (result) {
    // Abandon active progress for this playbook
    await PlaybookProgress.updateMany(
      { playbookId: id, status: 'active' },
      { status: 'abandoned' }
    );
  }
  return result;
}

export async function togglePlaybook(id: string, isActive: boolean) {
  return Playbook.findByIdAndUpdate(id, { isActive }, { new: true }).lean();
}

// ─── PLAYBOOK MATCHING ──────────────────────────────────────

/**
 * Find playbooks that match given triggers (disposition, tags, category, etc.)
 * Matching is case-insensitive for text values.
 */
export async function findMatchingPlaybooks(context: {
  dispositionId?: string;
  dispositionCode?: string;
  dispositionName?: string;
  tags?: string[];
  category?: string;
  intent?: string;
}) {
  const orConditions: Record<string, any>[] = [];

  if (context.dispositionId) {
    orConditions.push({ 'triggers.type': 'disposition', 'triggers.value': context.dispositionId });
  }
  // Also match category triggers against disposition code/name (case-insensitive)
  if (context.dispositionCode) {
    orConditions.push({ 'triggers.type': 'category', 'triggers.value': { $regex: new RegExp(`^${escapeRegex(context.dispositionCode)}$`, 'i') } });
  }
  if (context.dispositionName) {
    orConditions.push({ 'triggers.type': 'category', 'triggers.value': { $regex: new RegExp(`^${escapeRegex(context.dispositionName)}$`, 'i') } });
  }
  if (context.tags?.length) {
    // Case-insensitive tag matching
    const tagPatterns = context.tags.map(t => new RegExp(`^${escapeRegex(t)}$`, 'i'));
    orConditions.push({ 'triggers.type': 'tag', 'triggers.value': { $in: tagPatterns } });
  }
  if (context.category) {
    orConditions.push({ 'triggers.type': 'category', 'triggers.value': { $regex: new RegExp(`^${escapeRegex(context.category)}$`, 'i') } });
  }
  if (context.intent) {
    orConditions.push({ 'triggers.type': 'intent', 'triggers.value': context.intent });
  }

  if (orConditions.length === 0) return [];

  return Playbook.find({
    isActive: true,
    $or: orConditions,
  }).sort({ isMandatory: -1, name: 1 }).lean();
}

/** Escape special regex characters */
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get all active playbooks with manual trigger (always shown as available)
 */
export async function getManualPlaybooks() {
  return Playbook.find({
    isActive: true,
    'triggers.type': 'manual',
  }).sort({ name: 1 }).lean();
}

/**
 * Get all active playbooks (for manual browse)
 */
export async function getAvailablePlaybooks() {
  return Playbook.find({ isActive: true }).sort({ isMandatory: -1, name: 1 }).lean();
}

// ─── PROGRESS TRACKING ──────────────────────────────────────

export async function startPlaybook(sessionId: string, playbookId: string, agentId: string) {
  const playbook = await Playbook.findById(playbookId).lean();
  if (!playbook) throw new Error('Playbook not found');

  // Check if already active for this session — return existing
  const existing = await PlaybookProgress.findOne({
    sessionId,
    playbookId,
    status: 'active',
  });
  if (existing) return existing;

  // Remove any completed/abandoned old progress so the unique index doesn't block re-start
  await PlaybookProgress.deleteMany({
    sessionId,
    playbookId,
    status: { $in: ['completed', 'abandoned'] },
  });

  const progress = new PlaybookProgress({
    sessionId,
    playbookId,
    playbookVersion: playbook.version,
    agentId,
    steps: playbook.steps.map((s: IPlaybookStep) => ({
      stepId: s.stepId,
      status: 'pending' as StepStatus,
    })),
    status: 'active',
    completionPercent: 0,
    startedAt: new Date(),
  });

  return progress.save();
}

export async function getActiveProgress(sessionId: string) {
  return PlaybookProgress.findOne({ sessionId, status: 'active' })
    .populate('playbookId')
    .populate('agentId', 'name email')
    .lean();
}

export async function getProgressBySession(sessionId: string) {
  return PlaybookProgress.find({ sessionId })
    .populate('playbookId')
    .populate('agentId', 'name email')
    .sort({ createdAt: -1 })
    .lean();
}

export async function completeStep(
  sessionId: string,
  stepId: string,
  agentId: string,
  actionResult?: string
) {
  const progress = await PlaybookProgress.findOne({ sessionId, status: 'active' });
  if (!progress) throw new Error('No active playbook for this session');

  const step = progress.steps.find((s: IStepProgress) => s.stepId === stepId);
  if (!step) throw new Error('Step not found');

  step.status = 'completed';
  step.completedAt = new Date();
  step.completedBy = agentId as any;
  if (actionResult) step.actionResult = actionResult;

  // Recalculate completion
  const total = progress.steps.length;
  const done = progress.steps.filter((s: IStepProgress) => s.status !== 'pending').length;
  progress.completionPercent = Math.round((done / total) * 100);

  // Check if all done
  if (progress.steps.every((s: IStepProgress) => s.status !== 'pending')) {
    progress.status = 'completed';
    progress.completedAt = new Date();
  }

  await progress.save();
  return progress.toObject();
}

export async function skipStep(
  sessionId: string,
  stepId: string,
  agentId: string,
  reason: string
) {
  const progress = await PlaybookProgress.findOne({ sessionId, status: 'active' });
  if (!progress) throw new Error('No active playbook for this session');

  const step = progress.steps.find((s: IStepProgress) => s.stepId === stepId);
  if (!step) throw new Error('Step not found');

  step.status = 'skipped';
  step.completedAt = new Date();
  step.completedBy = agentId as any;
  step.skipReason = reason;

  // Recalculate
  const total = progress.steps.length;
  const done = progress.steps.filter((s: IStepProgress) => s.status !== 'pending').length;
  progress.completionPercent = Math.round((done / total) * 100);

  if (progress.steps.every((s: IStepProgress) => s.status !== 'pending')) {
    progress.status = 'completed';
    progress.completedAt = new Date();
  }

  await progress.save();
  return progress.toObject();
}

export async function abandonPlaybook(sessionId: string) {
  return PlaybookProgress.findOneAndUpdate(
    { sessionId, status: 'active' },
    { status: 'abandoned' },
    { new: true }
  ).lean();
}

// ─── CLOSE VALIDATION ───────────────────────────────────────

/**
 * Check if a chat can be closed (all critical steps must be done)
 * Returns { canClose, pendingCriticalSteps }
 */
export async function validateBeforeClose(sessionId: string) {
  const progress = await PlaybookProgress.findOne({ sessionId, status: 'active' }).populate('playbookId');
  
  if (!progress) return { canClose: true, pendingCriticalSteps: [], playbookName: null };

  const playbook = progress.playbookId as any as IPlaybook;
  if (!playbook?.isMandatory) return { canClose: true, pendingCriticalSteps: [], playbookName: playbook?.name };

  const pendingCriticalSteps: { stepId: string; label: string }[] = [];

  for (const stepProgress of progress.steps) {
    if (stepProgress.status === 'pending') {
      const stepDef = playbook.steps?.find((s: IPlaybookStep) => s.stepId === stepProgress.stepId);
      if (stepDef?.isCritical) {
        pendingCriticalSteps.push({ stepId: stepDef.stepId, label: stepDef.label });
      }
    }
  }

  return {
    canClose: pendingCriticalSteps.length === 0,
    pendingCriticalSteps,
    playbookName: playbook.name,
  };
}

// ─── QA INTEGRATION ─────────────────────────────────────────

/**
 * Get playbook completion data for QA scoring
 */
export async function getPlaybookQAData(sessionId: string) {
  const progress = await PlaybookProgress.findOne({ sessionId })
    .sort({ createdAt: -1 })
    .populate('playbookId')
    .lean();

  if (!progress) return null;

  const playbook = progress.playbookId as any as IPlaybook;

  const criticalSteps = playbook.steps?.filter((s: IPlaybookStep) => s.isCritical) || [];
  const criticalCompleted = criticalSteps.filter((s: IPlaybookStep) =>
    progress.steps.find((p: IStepProgress) => p.stepId === s.stepId && p.status === 'completed')
  );

  return {
    playbookName: playbook.name,
    isMandatory: playbook.isMandatory,
    totalSteps: progress.steps.length,
    completedSteps: progress.steps.filter((s: IStepProgress) => s.status === 'completed').length,
    skippedSteps: progress.steps.filter((s: IStepProgress) => s.status === 'skipped').length,
    completionPercent: progress.completionPercent,
    criticalTotal: criticalSteps.length,
    criticalCompleted: criticalCompleted.length,
    wasCompleted: progress.status === 'completed',
    wasAbandoned: progress.status === 'abandoned',
  };
}

// ─── TEMPLATE VARIABLE REPLACEMENT ──────────────────────────

export function replacePlaybookVariables(
  text: string,
  context: {
    userName?: string;
    userFirstName?: string;
    userEmail?: string;
    chatId?: string;
    agentName?: string;
    orderId?: string;
    [key: string]: string | undefined;
  }
): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const k = key.trim();
    const map: Record<string, string | undefined> = {
      'user.firstName': context.userFirstName,
      'user.name': context.userName,
      'user.email': context.userEmail,
      'chat.id': context.chatId,
      'agent.name': context.agentName,
      'order.id': context.orderId,
    };
    return map[k] ?? context[k] ?? match;
  });
}

// ─── SEED DEFAULT PLAYBOOKS ─────────────────────────────────

export async function seedDefaultPlaybooks(agentId: string) {
  const count = await Playbook.countDocuments();
  if (count > 0) return; // Don't seed if playbooks already exist

  const defaults: Partial<IPlaybook>[] = [
    {
      name: 'Proceso de Reembolso',
      description: 'Flujo obligatorio para gestionar solicitudes de reembolso',
      category: 'refund',
      isMandatory: true,
      isActive: true,
      triggers: [
        { type: 'category', value: 'refund' },
        { type: 'tag', value: 'reembolso' },
      ],
      steps: [
        { stepId: 'refund_1', type: 'question', label: 'Solicitar correo electrónico', description: 'Pedir al usuario su correo para verificar la cuenta', action: 'send_template', templateText: 'Hola {{user.firstName}}, para procesar tu solicitud necesito verificar tu correo electrónico. ¿Podrías confirmármelo?', isCritical: true, order: 1, skipRequiresComment: true },
        { stepId: 'refund_2', type: 'validation', label: 'Validar identidad', description: 'Verificar que el usuario es titular de la cuenta', action: 'open_modal', modalType: 'identity_validation', isCritical: true, order: 2, skipRequiresComment: true },
        { stepId: 'refund_3', type: 'question', label: 'Confirmar número de orden', description: 'Solicitar y verificar el número de orden', action: 'send_template', templateText: '¿Podrías proporcionarme el número de orden o referencia de tu compra?', isCritical: true, order: 3, skipRequiresComment: true },
        { stepId: 'refund_4', type: 'action_button', label: 'Explicar política de reembolso', description: 'Enviar la política de reembolso al cliente', action: 'send_template', templateText: 'Nuestra política de reembolso permite devoluciones dentro de los 30 días posteriores a la compra. El proceso toma entre 5-10 días hábiles una vez aprobado.', isCritical: false, order: 4, skipRequiresComment: false },
        { stepId: 'refund_5', type: 'checklist', label: 'Registrar en sistema interno', description: 'Crear ticket de reembolso en el sistema', action: 'none', isCritical: true, order: 5, skipRequiresComment: true },
        { stepId: 'refund_6', type: 'escalation', label: 'Escalar si aplica', description: 'Si el monto supera el límite, escalar al supervisor', action: 'escalate_supervisor', isCritical: false, order: 6, skipRequiresComment: false },
      ],
    },
    {
      name: 'Soporte Técnico',
      description: 'Guía para resolver problemas técnicos paso a paso',
      category: 'technical_support',
      isMandatory: false,
      isActive: true,
      triggers: [
        { type: 'category', value: 'technical_support' },
        { type: 'tag', value: 'soporte-tecnico' },
      ],
      steps: [
        { stepId: 'tech_1', type: 'question', label: 'Identificar el problema', description: 'Preguntar al usuario qué problema experimenta', action: 'send_template', templateText: 'Hola {{user.firstName}}, lamento que estés experimentando problemas. ¿Podrías describirme exactamente qué sucede?', isCritical: true, order: 1, skipRequiresComment: false },
        { stepId: 'tech_2', type: 'checklist', label: 'Verificar dispositivo/navegador', description: 'Preguntar qué dispositivo y navegador usa', action: 'none', isCritical: false, order: 2, skipRequiresComment: false },
        { stepId: 'tech_3', type: 'action_button', label: 'Solicitar capturas de pantalla', description: 'Pedir evidencia visual del problema', action: 'send_template', templateText: '¿Podrías enviarme una captura de pantalla del error que ves? Esto me ayudará a diagnosticar el problema más rápido.', isCritical: false, order: 3, skipRequiresComment: false },
        { stepId: 'tech_4', type: 'checklist', label: 'Intentar solución básica', description: 'Guiar al usuario con troubleshooting básico', action: 'none', isCritical: true, order: 4, skipRequiresComment: true },
        { stepId: 'tech_5', type: 'internal_note', label: 'Documentar diagnóstico', description: 'Crear nota interna con el diagnóstico', action: 'create_note', isCritical: false, order: 5, skipRequiresComment: false },
        { stepId: 'tech_6', type: 'escalation', label: 'Escalar a nivel 2 si no se resuelve', description: 'Si el problema persiste, escalar', action: 'escalate_supervisor', isCritical: false, order: 6, skipRequiresComment: false },
      ],
    },
    {
      name: 'Queja Grave',
      description: 'Protocolo para manejar quejas serias o clientes molestos',
      category: 'complaint',
      isMandatory: true,
      isActive: true,
      triggers: [
        { type: 'category', value: 'complaint' },
        { type: 'tag', value: 'queja' },
        { type: 'tag', value: 'queja-grave' },
      ],
      steps: [
        { stepId: 'complaint_1', type: 'checklist', label: 'Escuchar sin interrumpir', description: 'Dejar que el cliente exprese su frustración completamente', action: 'none', isCritical: true, order: 1, skipRequiresComment: false },
        { stepId: 'complaint_2', type: 'action_button', label: 'Mostrar empatía', description: 'Enviar mensaje empático personalizado', action: 'send_template', templateText: 'Entiendo perfectamente tu frustración, {{user.firstName}}. Lamento mucho esta experiencia. Voy a hacer todo lo posible para resolver esto.', isCritical: true, order: 2, skipRequiresComment: true },
        { stepId: 'complaint_3', type: 'question', label: 'Documentar la queja', description: 'Registrar los detalles específicos de la queja', action: 'none', isCritical: true, order: 3, skipRequiresComment: true },
        { stepId: 'complaint_4', type: 'internal_note', label: 'Crear nota con detalles', description: 'Registrar nota interna con todos los detalles', action: 'create_note', isCritical: true, order: 4, skipRequiresComment: true },
        { stepId: 'complaint_5', type: 'escalation', label: 'Notificar supervisor', description: 'Siempre escalar quejas graves al supervisor', action: 'escalate_supervisor', isCritical: true, order: 5, skipRequiresComment: true },
        { stepId: 'complaint_6', type: 'action_button', label: 'Ofrecer seguimiento', description: 'Comprometerse con seguimiento en 24-48h', action: 'send_template', templateText: 'Me comprometo a darle seguimiento a tu caso personalmente. Te contactaré en un máximo de 24 horas con una actualización. ¿Hay algo más en lo que pueda ayudarte ahora?', isCritical: false, order: 6, skipRequiresComment: false },
      ],
    },
    {
      name: 'Onboarding VIP',
      description: 'Proceso de bienvenida para clientes VIP',
      category: 'vip_onboarding',
      isMandatory: false,
      isActive: true,
      triggers: [
        { type: 'tag', value: 'vip' },
        { type: 'category', value: 'vip_onboarding' },
      ],
      steps: [
        { stepId: 'vip_1', type: 'action_button', label: 'Bienvenida personalizada', description: 'Enviar saludo VIP', action: 'send_template', templateText: '¡Bienvenido/a {{user.firstName}}! Soy {{agent.name}}, tu asesor personal VIP. Estoy aquí para asegurarme de que tengas la mejor experiencia posible. ¿En qué puedo asistirte hoy?', isCritical: true, order: 1, skipRequiresComment: false },
        { stepId: 'vip_2', type: 'checklist', label: 'Verificar perfil completo', description: 'Confirmar que la información del perfil está actualizada', action: 'none', isCritical: false, order: 2, skipRequiresComment: false },
        { stepId: 'vip_3', type: 'action_button', label: 'Asignar etiqueta VIP', description: 'Etiquetar al usuario como VIP', action: 'assign_tag', tagName: 'vip-verified', isCritical: true, order: 3, skipRequiresComment: false },
        { stepId: 'vip_4', type: 'checklist', label: 'Explicar beneficios VIP', description: 'Informar sobre beneficios exclusivos', action: 'none', isCritical: false, order: 4, skipRequiresComment: false },
        { stepId: 'vip_5', type: 'internal_note', label: 'Registrar interacción VIP', description: 'Crear nota con detalles del onboarding', action: 'create_note', isCritical: false, order: 5, skipRequiresComment: false },
      ],
    },
  ];

  for (const data of defaults) {
    await createPlaybook(data, agentId);
  }
}
