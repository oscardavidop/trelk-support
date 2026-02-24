/**
 * AgentEnginePage - Central configuration UI for the Agent Rule Engine
 * Manages global/team/agent configs, auxiliary state rules, break policies,
 * capacity settings, and engine cache.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings2, Save, Loader2, RefreshCw, CheckCircle, Shield,
  ToggleLeft, ToggleRight, Clock, Users, Zap, AlertCircle,
  ChevronDown, ChevronRight, Coffee, Activity, Eye, Cpu,
  Hash, Timer, Lock, Unlock, ArrowRight, Database,
} from 'lucide-react';
import {
  getGlobalConfig, updateGlobalConfig, rebuildCache, getEngineVersion,
  type EngineConfig,
} from '../services/agent-engine.service';
import { useAuthStore } from '../stores/authStore';

// ─── Field Metadata ────────────────────────────────────────────────────────

interface FieldMeta {
  key: keyof EngineConfig;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string';
  section: string;
  icon: React.ElementType;
  min?: number;
  max?: number;
}

const FIELD_META: FieldMeta[] = [
  // ── Capacity ──
  { key: 'maxChatsDefault', label: 'Chats simultáneos por defecto', description: 'Máximo de chats que un agente puede atender a la vez', type: 'number', section: 'capacity', icon: Hash, min: 1, max: 50 },
  { key: 'maxConcurrentSessions', label: 'Sesiones concurrentes', description: 'Máximo de sesiones de navegador activas por agente', type: 'number', section: 'capacity', icon: Users, min: 1, max: 10 },
  { key: 'allowMultiSession', label: 'Permitir multi-sesión', description: 'Permitir que un agente tenga múltiples sesiones abiertas simultáneamente', type: 'boolean', section: 'capacity', icon: Users },
  { key: 'enableDynamicCapacity', label: 'Capacidad dinámica', description: 'Ajustar automáticamente la capacidad del agente según métricas de rendimiento', type: 'boolean', section: 'capacity', icon: Zap },

  // ── Assignment ──
  { key: 'blockAssignmentIfNoHeartbeat', label: 'Bloquear sin heartbeat', description: 'No asignar chats si el agente no tiene heartbeat activo', type: 'boolean', section: 'assignment', icon: Activity },
  { key: 'autoSetBusyWhenMaxChats', label: 'Auto-busy al máximo', description: 'Cambiar automáticamente a "busy" cuando el agente alcanza capacidad máxima', type: 'boolean', section: 'assignment', icon: Shield },
  { key: 'allowStateChangeWithActiveChats', label: 'Cambio de estado con chats activos', description: 'Permitir que un agente cambie de estado mientras tiene chats abiertos', type: 'boolean', section: 'assignment', icon: ArrowRight },

  // ── Heartbeat ──
  { key: 'heartbeatTimeoutSeconds', label: 'Timeout de heartbeat (seg)', description: 'Segundos sin heartbeat antes de marcar al agente como desconectado', type: 'number', section: 'heartbeat', icon: Timer, min: 30, max: 600 },
  { key: 'reconcileOnBoot', label: 'Reconciliar al iniciar', description: 'Sincronizar estado de todos los agentes al reiniciar el servidor', type: 'boolean', section: 'heartbeat', icon: RefreshCw },

  // ── Breaks ──
  { key: 'maxDailyBreakMinutes', label: 'Break diario máximo (min)', description: 'Minutos máximos de break permitidos por día', type: 'number', section: 'breaks', icon: Coffee, min: 0, max: 480 },
  { key: 'breakRequiresReason', label: 'Reason obligatorio', description: 'El agente debe indicar motivo al tomar break', type: 'boolean', section: 'breaks', icon: AlertCircle },
  { key: 'countBreakAsPaid', label: 'Break como tiempo pagado', description: 'Contabilizar el break como tiempo productivo en reportes', type: 'boolean', section: 'breaks', icon: Clock },
  { key: 'strictPayrollMode', label: 'Modo nómina estricto', description: 'Activar control estricto de tiempos para integración con nómina', type: 'boolean', section: 'breaks', icon: Lock },

  // ── Idle ──
  { key: 'autoBreakOnIdleMinutes', label: 'Auto-break por inactividad (min)', description: 'Minutos de inactividad antes de mover al agente a break automáticamente (0 = desactivado)', type: 'number', section: 'idle', icon: Clock, min: 0, max: 120 },
  { key: 'autoBreakTargetStateCode', label: 'Estado destino de auto-break', description: 'Código del estado auxiliar al que se moverá el agente por inactividad', type: 'string', section: 'idle', icon: ArrowRight },

  // ── Supervisor ──
  { key: 'allowSupervisorForceState', label: 'Supervisor puede forzar estado', description: 'Permitir que un supervisor cambie el estado de cualquier agente', type: 'boolean', section: 'supervisor', icon: Shield },
  { key: 'allowManualBusy', label: 'Permitir busy manual', description: 'Permitir que un agente se ponga en busy sin chats activos', type: 'boolean', section: 'supervisor', icon: Unlock },

  // ── Rules ──
  { key: 'enableAuxiliaryRules', label: 'Reglas de estados auxiliares', description: 'Activar validación de transiciones permitidas entre estados auxiliares', type: 'boolean', section: 'rules', icon: Shield },
  { key: 'enableSlaImpact', label: 'Impacto SLA', description: 'Considerar el estado auxiliar del agente en los cálculos de SLA', type: 'boolean', section: 'rules', icon: Activity },
];

const SECTIONS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'capacity', label: 'Capacidad', icon: Users },
  { key: 'assignment', label: 'Asignación', icon: Zap },
  { key: 'heartbeat', label: 'Heartbeat', icon: Activity },
  { key: 'breaks', label: 'Breaks', icon: Coffee },
  { key: 'idle', label: 'Inactividad', icon: Clock },
  { key: 'supervisor', label: 'Supervisor', icon: Eye },
  { key: 'rules', label: 'Reglas', icon: Shield },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function AgentEnginePage() {
  const { token } = useAuthStore();

  // State
  const [config, setConfig] = useState<EngineConfig | null>(null);
  const [defaults, setDefaults] = useState<EngineConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuildingCache, setRebuildingCache] = useState(false);
  const [version, setVersion] = useState<number>(0);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(SECTIONS.map(s => s.key)));

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, verRes] = await Promise.all([getGlobalConfig(), getEngineVersion()]);
      setConfig(cfgRes.data);
      setDefaults(cfgRes.defaults);
      setVersion(verRes.version);
      setDirty(false);
    } catch (e: any) {
      showToast('error', 'Error al cargar configuración: ' + (e?.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const updateField = (key: keyof EngineConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setDirty(true);
  };

  const resetField = (key: keyof EngineConfig) => {
    if (!config || !defaults) return;
    setConfig({ ...config, [key]: defaults[key] });
    setDirty(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateGlobalConfig(config);
      setDirty(false);
      showToast('success', 'Configuración guardada correctamente');
      // Refresh version
      const verRes = await getEngineVersion();
      setVersion(verRes.version);
    } catch (e: any) {
      showToast('error', 'Error al guardar: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Rebuild Cache ─────────────────────────────────────────────────────────

  const handleRebuildCache = async () => {
    setRebuildingCache(true);
    try {
      const res = await rebuildCache();
      setVersion(res.version);
      showToast('success', 'Cache reconstruida — versión ' + res.version);
    } catch (e: any) {
      showToast('error', 'Error al reconstruir cache: ' + (e?.response?.data?.error || e.message));
    } finally {
      setRebuildingCache(false);
    }
  };

  // ── Render Field ──────────────────────────────────────────────────────────

  const renderField = (field: FieldMeta) => {
    if (!config || !defaults) return null;
    const value = config[field.key];
    const defaultValue = defaults[field.key];
    const isModified = value !== defaultValue;
    const Icon = field.icon;

    return (
      <div
        key={field.key}
        className={`group flex items-start gap-4 p-4 rounded-xl border transition-all ${
          isModified
            ? 'border-purple-500/30 bg-purple-500/5'
            : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
        }`}
      >
        {/* Icon */}
        <div className={`mt-0.5 p-2 rounded-lg ${isModified ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400'}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Label + Description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100">{field.label}</span>
            {isModified && (
              <button
                onClick={() => resetField(field.key)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                title="Restaurar valor por defecto"
              >
                reset
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{field.description}</p>
        </div>

        {/* Control */}
        <div className="flex-shrink-0 flex items-center mt-1">
          {field.type === 'boolean' ? (
            <button
              onClick={() => updateField(field.key, !value)}
              className="relative flex items-center"
              title={value ? 'Activado' : 'Desactivado'}
            >
              {value ? (
                <ToggleRight className="w-8 h-8 text-purple-500 transition-colors" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-zinc-600 transition-colors" />
              )}
            </button>
          ) : field.type === 'number' ? (
            <input
              type="number"
              value={value as number}
              onChange={e => updateField(field.key, Number(e.target.value))}
              min={field.min}
              max={field.max}
              className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 text-center focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            />
          ) : (
            <input
              type="text"
              value={value as string}
              onChange={e => updateField(field.key, e.target.value)}
              className="w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            />
          )}
        </div>
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 min-h-screen">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl flex-1 bg-zinc-950 min-h-screen overflow-auto ">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl border transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 rounded-xl">
                <Cpu className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-zinc-100">Agent Engine</h1>
                <p className="text-xs text-zinc-500">Configuración central del motor de reglas de agentes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Version badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                <Database className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">v{version}</span>
              </div>
              {/* Rebuild cache */}
              <button
                onClick={handleRebuildCache}
                disabled={rebuildingCache}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${rebuildingCache ? 'animate-spin' : ''}`} />
                <span className="text-xs font-medium">Rebuild Cache</span>
              </button>
              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  dirty
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Chats/Agente', value: config?.maxChatsDefault ?? '-', icon: Hash, color: 'purple' },
            { label: 'Heartbeat', value: `${config?.heartbeatTimeoutSeconds ?? '-'}s`, icon: Activity, color: 'emerald' },
            { label: 'Break Diario', value: `${config?.maxDailyBreakMinutes ?? '-'}m`, icon: Coffee, color: 'amber' },
            { label: 'Auto-Idle', value: config?.autoBreakOnIdleMinutes ? `${config.autoBreakOnIdleMinutes}m` : 'Off', icon: Clock, color: 'blue' },
          ].map(card => (
            <div key={card.label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`w-4 h-4 text-${card.color}-400`} />
                <span className="text-xs text-zinc-500">{card.label}</span>
              </div>
              <span className="text-xl font-bold text-zinc-100">{card.value}</span>
            </div>
          ))}
        </div>

        {/* Config sections */}
        {SECTIONS.map(section => {
          const fields = FIELD_META.filter(f => f.section === section.key);
          const isExpanded = expandedSections.has(section.key);
          const modifiedCount = fields.filter(f => config && defaults && config[f.key] !== defaults[f.key]).length;
          const SectionIcon = section.icon;

          return (
            <div key={section.key} className="border border-zinc-800 rounded-xl overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-900/60 hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <SectionIcon className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-zinc-200">{section.label}</span>
                  {modifiedCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/20 text-purple-400">
                      {modifiedCount} modificado{modifiedCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">{fields.length} campos</span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
              </button>

              {/* Section fields */}
              {isExpanded && (
                <div className="p-4 space-y-3 bg-zinc-950">
                  {fields.map(f => renderField(f))}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/40 border border-zinc-800/50 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Settings2 className="w-3.5 h-3.5" />
            <span>Las configuraciones por equipo y por agente se gestionan desde el panel de Supervisor.</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span>Prioridad: Agente → Equipo → Global → Defaults</span>
          </div>
        </div>
      </div>
    </div>
  );
}
