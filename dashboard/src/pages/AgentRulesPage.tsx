/**
 * AgentRulesPage - Agent Login Policy & Chat Rules Configuration
 * New settings tab for configuring agent login policies and chat action rules
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
    ShieldCheck,
    Clock,
    MapPin,
    Smartphone,
    Users,
    UserCog,
    AlertTriangle,
    Bell,
    FileText,
    MessageSquare,
    Settings2,
    Save,
    Loader2,
    RefreshCw,
    CheckCircle,
    ChevronRight,
    ChevronDown,
    Plus,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Globe,
    Lock,
    Unlock,
    ArrowRight,
    AlertCircle,
    ClipboardList,
    Zap,
    Shield,
    Eye,
    Ban,
    Tag,
    Pencil,
    X,
    ArrowLeft,
} from 'lucide-react';

// ============= TYPES =============

interface WorkingHours {
    enabled: boolean;
    schedule: { start: string; end: string };
    timezone: string;
    daysOfWeek: number[];
    blockOutsideHours: boolean;
    allowReadOnlyOutsideHours: boolean;
}

interface Redirects {
    defaultLandingPage: string;
    roleBasedRedirects: { role: string; redirectTo: string }[];
    forceCompleteProfile: boolean;
    profileCompletionPage: string;
}

interface LocationRestriction {
    enabled: boolean;
    allowedCountries: string[];
    allowedIpRanges: string[];
    blockAction: 'block' | 'alert' | 'mfa';
}

interface DeviceTrust {
    enabled: boolean;
    requireMFAOnNewDevice: boolean;
    maxTrustedDevices: number;
    trustDurationDays: number;
}

interface SessionPolicy {
    maxConcurrentSessions: number;
    forceLogoutOnNewLogin: boolean;
    maxSessionAgeHours: number;
    requireReauthAfterHours: number;
    forceLogoutAtTime: string;
}

interface ProfileRequirements {
    requireTelegramLink: boolean;
    requireMFAEnabled: boolean;
    requireDisplayName: boolean;
    requireAvatar: boolean;
    blockUntilComplete: boolean;
}

interface AutoStatus {
    enabled: boolean;
    defaultStatusOnLogin: 'online' | 'away' | 'busy';
    statusOutsideHours: 'away' | 'offline';
    setOfflineOnLogout: boolean;
}

interface GlobalAlert {
    enabled: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'critical';
    requireAcknowledge: boolean;
    showFullScreen: boolean;
    expiresAt?: string;
}

interface MaintenanceMode {
    enabled: boolean;
    allowedRoles: string[];
    readOnlyForOthers: boolean;
    message: string;
}

interface SupervisorAlerts {
    onLoginOutsideHours: boolean;
    onNewDeviceLogin: boolean;
    onBlockedLogin: boolean;
    onSuspiciousActivity: boolean;
    onMultipleFailedAttempts: boolean;
}

interface ChatActionRule {
    id: string;
    name: string;
    enabled: boolean;
    action: string;
    condition: {
        type: string;
        roles?: string[];
        minNoteLength?: number;
        requiredTags?: string[];
        approvalRoles?: string[];
        allowedHours?: { start: string; end: string };
    };
    errorMessage: string;
    bypassRoles: string[];
}

interface PolicySettings {
    workingHours: WorkingHours;
    redirects: Redirects;
    locationRestriction: LocationRestriction;
    deviceTrust: DeviceTrust;
    sessionPolicy: SessionPolicy;
    profileRequirements: ProfileRequirements;
    autoStatus: AutoStatus;
    globalAlert: GlobalAlert;
    maintenanceMode: MaintenanceMode;
    supervisorAlerts: SupervisorAlerts;
    chatActionRules: ChatActionRule[];
}

// ============= DEFAULT VALUES =============

const defaultPolicy: PolicySettings = {
    workingHours: {
        enabled: false,
        schedule: { start: '09:00', end: '18:00' },
        timezone: 'America/Bogota',
        daysOfWeek: [1, 2, 3, 4, 5],
        blockOutsideHours: false,
        allowReadOnlyOutsideHours: true,
    },
    redirects: {
        defaultLandingPage: '/chat',
        roleBasedRedirects: [
            { role: 'admin', redirectTo: '/overview' },
            { role: 'supervisor', redirectTo: '/supervisor' },
            { role: 'support', redirectTo: '/chat' },
        ],
        forceCompleteProfile: true,
        profileCompletionPage: '/my-settings',
    },
    locationRestriction: {
        enabled: false,
        allowedCountries: [],
        allowedIpRanges: [],
        blockAction: 'alert',
    },
    deviceTrust: {
        enabled: true,
        requireMFAOnNewDevice: true,
        maxTrustedDevices: 5,
        trustDurationDays: 30,
    },
    sessionPolicy: {
        maxConcurrentSessions: 1,
        forceLogoutOnNewLogin: true,
        maxSessionAgeHours: 24,
        requireReauthAfterHours: 12,
        forceLogoutAtTime: '',
    },
    profileRequirements: {
        requireTelegramLink: true,
        requireMFAEnabled: false,
        requireDisplayName: true,
        requireAvatar: false,
        blockUntilComplete: false,
    },
    autoStatus: {
        enabled: true,
        defaultStatusOnLogin: 'online',
        statusOutsideHours: 'away',
        setOfflineOnLogout: true,
    },
    globalAlert: {
        enabled: false,
        title: '',
        message: '',
        type: 'info',
        requireAcknowledge: false,
        showFullScreen: false,
    },
    maintenanceMode: {
        enabled: false,
        allowedRoles: ['admin'],
        readOnlyForOthers: true,
        message: 'El sistema está en mantenimiento. Solo lectura disponible.',
    },
    supervisorAlerts: {
        onLoginOutsideHours: true,
        onNewDeviceLogin: true,
        onBlockedLogin: true,
        onSuspiciousActivity: true,
        onMultipleFailedAttempts: true,
    },
    chatActionRules: [],
};

type PolicySection = 'working_hours' | 'redirects' | 'location' | 'device' | 'session' | 'profile' | 'status' | 'alerts' | 'maintenance' | 'supervisor_alerts' | 'chat_rules';

const sections: { id: PolicySection; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'working_hours', label: 'Horarios', icon: <Clock className="w-5 h-5" />, description: 'Login por horario' },
    { id: 'redirects', label: 'Redirecciones', icon: <ArrowRight className="w-5 h-5" />, description: 'Páginas de inicio' },
    { id: 'location', label: 'Ubicación', icon: <MapPin className="w-5 h-5" />, description: 'IP y países' },
    { id: 'device', label: 'Dispositivos', icon: <Smartphone className="w-5 h-5" />, description: 'Confianza de dispositivo' },
    { id: 'session', label: 'Sesiones', icon: <Users className="w-5 h-5" />, description: 'Límites de sesión' },
    { id: 'profile', label: 'Perfil', icon: <UserCog className="w-5 h-5" />, description: 'Requisitos de perfil' },
    { id: 'status', label: 'Estado', icon: <Zap className="w-5 h-5" />, description: 'Estado automático' },
    { id: 'alerts', label: 'Alertas', icon: <AlertTriangle className="w-5 h-5" />, description: 'Alertas globales' },
    { id: 'maintenance', label: 'Mantenimiento', icon: <Settings2 className="w-5 h-5" />, description: 'Modo mantenimiento' },
    { id: 'supervisor_alerts', label: 'Notificaciones', icon: <Bell className="w-5 h-5" />, description: 'Alertas a supervisores' },
    { id: 'chat_rules', label: 'Reglas Chat', icon: <MessageSquare className="w-5 h-5" />, description: 'Acciones en chat' },
];

// ============= COMPONENTS =============

function ToggleField({ label, description, checked, onChange, disabled = false }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <div
            className={`flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 transition-all ${disabled ? 'opacity-50' : 'hover:border-zinc-700'}`}
            onClick={() => !disabled && onChange(!checked)}
        >
            <div>
                <p className="text-sm font-medium text-zinc-200">{label}</p>
                {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
            </div>
            <button
                type="button"
                disabled={disabled}
                className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-purple-600' : 'bg-zinc-700'}`}
            >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
            </button>
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text', placeholder, suffix, min, max, helper, disabled = false }: {
    label: string;
    value: string | number;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    suffix?: string;
    min?: number;
    max?: number;
    helper?: string;
    disabled?: boolean;
}) {
    return (
        <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">{label}</label>
            <div className="relative">
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    min={min}
                    max={max}
                    disabled={disabled}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-50 placeholder-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all disabled:opacity-50"
                />
                {suffix && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{suffix}</span>
                )}
            </div>
            {helper && <p className="text-xs text-zinc-500 mt-1">{helper}</p>}
        </div>
    );
}

function SelectField({ label, value, onChange, options, helper }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    helper?: string;
}) {
    return (
        <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all appearance-none"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {helper && <p className="text-xs text-zinc-500 mt-1">{helper}</p>}
        </div>
    );
}

function FormSection({ title, description, icon, children, collapsed = false, onToggle }: {
    title: string;
    description?: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    collapsed?: boolean;
    onToggle?: () => void;
}) {
    return (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div
                className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/60 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400 border border-zinc-700/50">{icon}</div>
                    <div>
                        <h3 className="text-base font-semibold text-zinc-50">{title}</h3>
                        {description && <p className="text-xs text-zinc-500">{description}</p>}
                    </div>
                </div>
                {onToggle && (
                    collapsed ? <ChevronRight className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />
                )}
            </div>
            {!collapsed && (
                <div className="p-6 space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
}

function DaySelector({ selected, onChange }: { selected: number[]; onChange: (days: number[]) => void }) {
    const days = [
        { value: 0, label: 'Dom' },
        { value: 1, label: 'Lun' },
        { value: 2, label: 'Mar' },
        { value: 3, label: 'Mié' },
        { value: 4, label: 'Jue' },
        { value: 5, label: 'Vie' },
        { value: 6, label: 'Sáb' },
    ];

    const toggleDay = (day: number) => {
        if (selected.includes(day)) {
            onChange(selected.filter(d => d !== day));
        } else {
            onChange([...selected, day].sort());
        }
    };

    return (
        <div className="flex gap-2">
            {days.map((day) => (
                <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${selected.includes(day.value)
                            ? 'bg-purple-600 text-zinc-50'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                >
                    {day.label}
                </button>
            ))}
        </div>
    );
}

function RoleSelector({ selected, onChange, label }: { selected: string[]; onChange: (roles: string[]) => void; label?: string }) {
    const roles = ['admin', 'supervisor', 'support', 'junior'];

    const toggleRole = (role: string) => {
        if (selected.includes(role)) {
            onChange(selected.filter(r => r !== role));
        } else {
            onChange([...selected, role]);
        }
    };

    return (
        <div>
            {label && <label className="text-sm font-medium text-zinc-300 mb-2 block">{label}</label>}
            <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                    <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selected.includes(role)
                                ? 'bg-purple-600 text-zinc-50'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                    >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder?: string }) {
    const [input, setInput] = useState('');

    const addTag = () => {
        if (input.trim() && !value.includes(input.trim())) {
            onChange([...value, input.trim()]);
            setInput('');
        }
    };

    const removeTag = (tag: string) => {
        onChange(value.filter(t => t !== tag));
    };

    return (
        <div>
            <div className="flex gap-2 mb-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder={placeholder}
                    className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 placeholder-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
                <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-zinc-50 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {value.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-3 py-1 bg-zinc-800 text-zinc-300 rounded-lg text-sm">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="text-zinc-500 hover:text-zinc-300">
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
}

// ============= CHAT RULE EDITOR =============

function ChatRuleEditor({ rule, onSave, onCancel }: {
    rule?: ChatActionRule;
    onSave: (rule: ChatActionRule) => void;
    onCancel: () => void;
}) {
    const [editedRule, setEditedRule] = useState<ChatActionRule>(rule || {
        id: `rule_${Date.now()}`,
        name: '',
        enabled: true,
        action: 'close_chat',
        condition: {
            type: 'require_note',
            minNoteLength: 10,
        },
        errorMessage: '',
        bypassRoles: ['admin'],
    });

    const actionOptions = [
        { value: 'close_chat', label: 'Cerrar chat' },
        { value: 'transfer_chat', label: 'Transferir chat' },
        { value: 'reopen_chat', label: 'Reabrir chat' },
        { value: 'block_user', label: 'Bloquear usuario' },
        { value: 'delete_message', label: 'Eliminar mensaje' },
        { value: 'send_file', label: 'Enviar archivo' },
    ];

    const conditionTypes = [
        { value: 'require_note', label: 'Requiere nota' },
        { value: 'require_tag', label: 'Requiere etiqueta' },
        { value: 'role_restriction', label: 'Solo ciertos roles' },
        { value: 'require_approval', label: 'Requiere aprobación' },
        { value: 'time_restriction', label: 'Restricción de horario' },
    ];

    return (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <InputField
                    label="Nombre de la regla"
                    value={editedRule.name}
                    onChange={(v) => setEditedRule({ ...editedRule, name: v })}
                    placeholder="Ej: Cerrar chat requiere nota"
                />
                <SelectField
                    label="Acción afectada"
                    value={editedRule.action}
                    onChange={(v) => setEditedRule({ ...editedRule, action: v })}
                    options={actionOptions}
                />
            </div>

            <SelectField
                label="Tipo de condición"
                value={editedRule.condition.type}
                onChange={(v) => setEditedRule({
                    ...editedRule,
                    condition: { ...editedRule.condition, type: v },
                })}
                options={conditionTypes}
            />

            {editedRule.condition.type === 'require_note' && (
                <InputField
                    label="Longitud mínima de nota"
                    value={editedRule.condition.minNoteLength || 10}
                    onChange={(v) => setEditedRule({
                        ...editedRule,
                        condition: { ...editedRule.condition, minNoteLength: parseInt(v) || 10 },
                    })}
                    type="number"
                    min={1}
                    suffix="caracteres"
                />
            )}

            {editedRule.condition.type === 'require_tag' && (
                <div>
                    <label className="text-sm font-medium text-zinc-300 mb-2 block">Etiquetas requeridas (al menos una)</label>
                    <TagInput
                        value={editedRule.condition.requiredTags || []}
                        onChange={(tags) => setEditedRule({
                            ...editedRule,
                            condition: { ...editedRule.condition, requiredTags: tags },
                        })}
                        placeholder="Añadir etiqueta..."
                    />
                </div>
            )}

            {editedRule.condition.type === 'role_restriction' && (
                <RoleSelector
                    label="Roles que pueden realizar la acción"
                    selected={editedRule.condition.roles || []}
                    onChange={(roles) => setEditedRule({
                        ...editedRule,
                        condition: { ...editedRule.condition, roles },
                    })}
                />
            )}

            {editedRule.condition.type === 'require_approval' && (
                <RoleSelector
                    label="Roles que pueden aprobar"
                    selected={editedRule.condition.approvalRoles || ['supervisor', 'admin']}
                    onChange={(roles) => setEditedRule({
                        ...editedRule,
                        condition: { ...editedRule.condition, approvalRoles: roles },
                    })}
                />
            )}

            {editedRule.condition.type === 'time_restriction' && (
                <div className="grid grid-cols-2 gap-4">
                    <InputField
                        label="Hora inicio"
                        value={editedRule.condition.allowedHours?.start || '09:00'}
                        onChange={(v) => setEditedRule({
                            ...editedRule,
                            condition: {
                                ...editedRule.condition,
                                allowedHours: { ...(editedRule.condition.allowedHours || { start: '09:00', end: '18:00' }), start: v },
                            },
                        })}
                        type="time"
                    />
                    <InputField
                        label="Hora fin"
                        value={editedRule.condition.allowedHours?.end || '18:00'}
                        onChange={(v) => setEditedRule({
                            ...editedRule,
                            condition: {
                                ...editedRule.condition,
                                allowedHours: { ...(editedRule.condition.allowedHours || { start: '09:00', end: '18:00' }), end: v },
                            },
                        })}
                        type="time"
                    />
                </div>
            )}

            <InputField
                label="Mensaje de error"
                value={editedRule.errorMessage}
                onChange={(v) => setEditedRule({ ...editedRule, errorMessage: v })}
                placeholder="Mensaje que verá el agente cuando no cumpla la regla"
            />

            <RoleSelector
                label="Roles que pueden omitir esta regla"
                selected={editedRule.bypassRoles}
                onChange={(roles) => setEditedRule({ ...editedRule, bypassRoles: roles })}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-700">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-zinc-400 hover:text-zinc-50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={() => onSave(editedRule)}
                    disabled={!editedRule.name || !editedRule.errorMessage}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-zinc-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Guardar Regla
                </button>
            </div>
        </div>
    );
}

// ============= MAIN COMPONENT =============

export default function AgentRulesPage() {
    const token = useAuthStore((state) => state.token);
    const [activeSection, setActiveSection] = useState<PolicySection>('working_hours');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [policy, setPolicy] = useState<PolicySettings>(defaultPolicy);
    const [editingRule, setEditingRule] = useState<ChatActionRule | null>(null);
    const [showNewRule, setShowNewRule] = useState(false);

    useEffect(() => {
        loadPolicy();
    }, []);

    const loadPolicy = async () => {
        try {
            const res = await fetch('/api/policy', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok && data.policy) {
                setPolicy({ ...defaultPolicy, ...data.policy });
            }
        } catch (error) {
            console.error('Failed to load policy:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            const res = await fetch('/api/policy', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(policy),
            });
            const data = await res.json();
            if (data.ok) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            }
        } catch (error) {
            console.error('Failed to save policy:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRule = (rule: ChatActionRule) => {
        const rules = policy.chatActionRules || [];
        const existingIndex = rules.findIndex(r => r.id === rule.id);

        if (existingIndex >= 0) {
            rules[existingIndex] = rule;
        } else {
            rules.push(rule);
        }

        setPolicy({ ...policy, chatActionRules: [...rules] });
        setEditingRule(null);
        setShowNewRule(false);
    };

    const handleDeleteRule = (ruleId: string) => {
        setPolicy({
            ...policy,
            chatActionRules: (policy.chatActionRules || []).filter(r => r.id !== ruleId),
        });
    };

    const handleToggleRule = (ruleId: string) => {
        setPolicy({
            ...policy,
            chatActionRules: (policy.chatActionRules || []).map(r =>
                r.id === ruleId ? { ...r, enabled: !r.enabled } : r
            ),
        });
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full bg-gray-950">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-purple-500/30">
            {/* Purple Ambient Glow */}
            <div className="absolute top-0 right-0 bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="flex-1 flex flex-col overflow-hidden relative z-0">
                {/* Header */}
                <div className="px-8 py-6 pb-2 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm z-20">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => window.history.back()}
                                className="p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6 text-purple-500" />
                            </button>
                            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-purple-900/10">
                                <ShieldCheck className="w-6 h-6 text-purple-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Reglas de Agentes</h1>
                                <p className="text-sm text-zinc-400">Políticas de login y reglas de chat</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {saveSuccess && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                    <CheckCircle className="w-4 h-4" /> Guardado
                                </div>
                            )}

                            <button
                                onClick={loadPolicy}
                                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-50 transition-all"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-zinc-50 font-medium rounded-xl shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                <span>Guardar Cambios</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-72 border-r border-zinc-800 bg-zinc-900/30 p-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeSection === section.id
                                        ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-sm'
                                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg transition-colors ${activeSection === section.id ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                                    }`}>
                                    {section.icon}
                                </div>
                                <div className="text-left flex-1">
                                    <p className={`font-medium text-sm ${activeSection === section.id ? 'text-zinc-50' : ''}`}>{section.label}</p>
                                    <p className="text-[10px] text-zinc-500 line-clamp-1">{section.description}</p>
                                </div>
                                {activeSection === section.id && <ChevronRight className="w-4 h-4 text-purple-500/50" />}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="px-10 overflow-y-auto py-8 custom-scrollbar bg-zinc-950/50">
                        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Working Hours */}
                            {activeSection === 'working_hours' && (
                                <FormSection title="Horario de Trabajo" description="Restricciones de login por horario" icon={<Clock className="w-5 h-5 text-blue-400" />}>
                                    <ToggleField
                                        label="Habilitar restricción de horario"
                                        description="Los agentes solo pueden acceder dentro del horario configurado"
                                        checked={policy.workingHours.enabled}
                                        onChange={(v) => setPolicy({ ...policy, workingHours: { ...policy.workingHours, enabled: v } })}
                                    />

                                    {policy.workingHours.enabled && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <InputField
                                                    label="Hora de inicio"
                                                    value={policy.workingHours.schedule.start}
                                                    onChange={(v) => setPolicy({
                                                        ...policy,
                                                        workingHours: { ...policy.workingHours, schedule: { ...policy.workingHours.schedule, start: v } },
                                                    })}
                                                    type="time"
                                                />
                                                <InputField
                                                    label="Hora de fin"
                                                    value={policy.workingHours.schedule.end}
                                                    onChange={(v) => setPolicy({
                                                        ...policy,
                                                        workingHours: { ...policy.workingHours, schedule: { ...policy.workingHours.schedule, end: v } },
                                                    })}
                                                    type="time"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-zinc-300 mb-3 block">Días laborales</label>
                                                <DaySelector
                                                    selected={policy.workingHours.daysOfWeek}
                                                    onChange={(days) => setPolicy({
                                                        ...policy,
                                                        workingHours: { ...policy.workingHours, daysOfWeek: days },
                                                    })}
                                                />
                                            </div>

                                            <SelectField
                                                label="Zona horaria"
                                                value={policy.workingHours.timezone}
                                                onChange={(v) => setPolicy({ ...policy, workingHours: { ...policy.workingHours, timezone: v } })}
                                                options={[
                                                    { value: 'America/Bogota', label: 'Colombia (GMT-5)' },
                                                    { value: 'America/Mexico_City', label: 'México (GMT-6)' },
                                                    { value: 'America/Buenos_Aires', label: 'Argentina (GMT-3)' },
                                                    { value: 'America/Santiago', label: 'Chile (GMT-4)' },
                                                    { value: 'Europe/Madrid', label: 'España (GMT+1)' },
                                                    { value: 'UTC', label: 'UTC' },
                                                ]}
                                            />

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <ToggleField
                                                    label="Bloquear fuera de horario"
                                                    description="Impedir login completamente"
                                                    checked={policy.workingHours.blockOutsideHours}
                                                    onChange={(v) => setPolicy({ ...policy, workingHours: { ...policy.workingHours, blockOutsideHours: v } })}
                                                />
                                                <ToggleField
                                                    label="Permitir solo lectura"
                                                    description="Acceso limitado fuera de horario"
                                                    checked={policy.workingHours.allowReadOnlyOutsideHours}
                                                    onChange={(v) => setPolicy({ ...policy, workingHours: { ...policy.workingHours, allowReadOnlyOutsideHours: v } })}
                                                    disabled={policy.workingHours.blockOutsideHours}
                                                />
                                            </div>
                                        </>
                                    )}
                                </FormSection>
                            )}

                            {/* Redirects */}
                            {activeSection === 'redirects' && (
                                <FormSection title="Redirecciones" description="Páginas de inicio por rol" icon={<ArrowRight className="w-5 h-5 text-green-400" />}>
                                    <InputField
                                        label="Página de inicio por defecto"
                                        value={policy.redirects.defaultLandingPage}
                                        onChange={(v) => setPolicy({ ...policy, redirects: { ...policy.redirects, defaultLandingPage: v } })}
                                        placeholder="/chat"
                                    />

                                    <div>
                                        <label className="text-sm font-medium text-zinc-300 mb-3 block">Redirecciones por rol</label>
                                        <div className="space-y-2">
                                            {(policy.redirects.roleBasedRedirects || []).map((redirect, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                                                    <span className="text-zinc-400 w-24">{redirect.role}</span>
                                                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                                                    <input
                                                        type="text"
                                                        value={redirect.redirectTo}
                                                        onChange={(e) => {
                                                            const newRedirects = [...policy.redirects.roleBasedRedirects];
                                                            newRedirects[idx] = { ...newRedirects[idx], redirectTo: e.target.value };
                                                            setPolicy({ ...policy, redirects: { ...policy.redirects, roleBasedRedirects: newRedirects } });
                                                        }}
                                                        className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-50 text-sm"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <ToggleField
                                        label="Forzar completar perfil"
                                        description="Redirigir a configuración si el perfil está incompleto"
                                        checked={policy.redirects.forceCompleteProfile}
                                        onChange={(v) => setPolicy({ ...policy, redirects: { ...policy.redirects, forceCompleteProfile: v } })}
                                    />
                                </FormSection>
                            )}

                            {/* Location Restriction */}
                            {activeSection === 'location' && (
                                <FormSection title="Restricción de Ubicación" description="Control por IP y país" icon={<MapPin className="w-5 h-5 text-red-400" />}>
                                    <ToggleField
                                        label="Habilitar restricción de ubicación"
                                        description="Restringir acceso por IP o país"
                                        checked={policy.locationRestriction.enabled}
                                        onChange={(v) => setPolicy({ ...policy, locationRestriction: { ...policy.locationRestriction, enabled: v } })}
                                    />

                                    {policy.locationRestriction.enabled && (
                                        <>
                                            <div>
                                                <label className="text-sm font-medium text-zinc-300 mb-2 block">IPs permitidas (CIDR)</label>
                                                <TagInput
                                                    value={policy.locationRestriction.allowedIpRanges}
                                                    onChange={(v) => setPolicy({ ...policy, locationRestriction: { ...policy.locationRestriction, allowedIpRanges: v } })}
                                                    placeholder="192.168.1.0/24"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-zinc-300 mb-2 block">Países permitidos (códigos ISO)</label>
                                                <TagInput
                                                    value={policy.locationRestriction.allowedCountries}
                                                    onChange={(v) => setPolicy({ ...policy, locationRestriction: { ...policy.locationRestriction, allowedCountries: v } })}
                                                    placeholder="CO, MX, ES"
                                                />
                                            </div>

                                            <SelectField
                                                label="Acción si está fuera del rango"
                                                value={policy.locationRestriction.blockAction}
                                                onChange={(v) => setPolicy({ ...policy, locationRestriction: { ...policy.locationRestriction, blockAction: v as any } })}
                                                options={[
                                                    { value: 'block', label: 'Bloquear acceso' },
                                                    { value: 'mfa', label: 'Requerir MFA adicional' },
                                                    { value: 'alert', label: 'Solo alertar a supervisores' },
                                                ]}
                                            />
                                        </>
                                    )}
                                </FormSection>
                            )}

                            {/* Device Trust */}
                            {activeSection === 'device' && (
                                <FormSection title="Confianza de Dispositivos" description="Gestión de dispositivos nuevos" icon={<Smartphone className="w-5 h-5 text-cyan-400" />}>
                                    <ToggleField
                                        label="Habilitar detección de dispositivos"
                                        description="Detectar cuando un agente inicia sesión desde un dispositivo nuevo"
                                        checked={policy.deviceTrust.enabled}
                                        onChange={(v) => setPolicy({ ...policy, deviceTrust: { ...policy.deviceTrust, enabled: v } })}
                                    />

                                    {policy.deviceTrust.enabled && (
                                        <>
                                            <ToggleField
                                                label="Requerir MFA en dispositivo nuevo"
                                                description="Solicitar verificación adicional en dispositivos no reconocidos"
                                                checked={policy.deviceTrust.requireMFAOnNewDevice}
                                                onChange={(v) => setPolicy({ ...policy, deviceTrust: { ...policy.deviceTrust, requireMFAOnNewDevice: v } })}
                                            />

                                            <div className="grid grid-cols-2 gap-4">
                                                <InputField
                                                    label="Máximo dispositivos confiables"
                                                    value={policy.deviceTrust.maxTrustedDevices}
                                                    onChange={(v) => setPolicy({ ...policy, deviceTrust: { ...policy.deviceTrust, maxTrustedDevices: parseInt(v) || 5 } })}
                                                    type="number"
                                                    min={1}
                                                    max={20}
                                                />
                                                <InputField
                                                    label="Duración de confianza"
                                                    value={policy.deviceTrust.trustDurationDays}
                                                    onChange={(v) => setPolicy({ ...policy, deviceTrust: { ...policy.deviceTrust, trustDurationDays: parseInt(v) || 30 } })}
                                                    type="number"
                                                    suffix="días"
                                                    min={1}
                                                    max={365}
                                                />
                                            </div>
                                        </>
                                    )}
                                </FormSection>
                            )}

                            {/* Session Policy */}
                            {activeSection === 'session' && (
                                <FormSection title="Política de Sesiones" description="Límites y control de sesiones" icon={<Users className="w-5 h-5 text-amber-400" />}>
                                    <InputField
                                        label="Máximo sesiones simultáneas"
                                        value={policy.sessionPolicy.maxConcurrentSessions}
                                        onChange={(v) => setPolicy({ ...policy, sessionPolicy: { ...policy.sessionPolicy, maxConcurrentSessions: parseInt(v) || 1 } })}
                                        type="number"
                                        min={1}
                                        max={10}
                                        helper="1 = Solo una sesión activa a la vez"
                                    />

                                    <ToggleField
                                        label="Cerrar sesión anterior en nuevo login"
                                        description="Automáticamente cierra sesiones previas cuando el agente inicia sesión"
                                        checked={policy.sessionPolicy.forceLogoutOnNewLogin}
                                        onChange={(v) => setPolicy({ ...policy, sessionPolicy: { ...policy.sessionPolicy, forceLogoutOnNewLogin: v } })}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField
                                            label="Duración máxima de sesión"
                                            value={policy.sessionPolicy.maxSessionAgeHours}
                                            onChange={(v) => setPolicy({ ...policy, sessionPolicy: { ...policy.sessionPolicy, maxSessionAgeHours: parseInt(v) || 24 } })}
                                            type="number"
                                            suffix="horas"
                                            min={1}
                                            max={168}
                                        />
                                        <InputField
                                            label="Reautenticar después de"
                                            value={policy.sessionPolicy.requireReauthAfterHours}
                                            onChange={(v) => setPolicy({ ...policy, sessionPolicy: { ...policy.sessionPolicy, requireReauthAfterHours: parseInt(v) || 12 } })}
                                            type="number"
                                            suffix="horas"
                                            min={1}
                                            max={48}
                                        />
                                    </div>

                                    <InputField
                                        label="Forzar logout a hora específica"
                                        value={policy.sessionPolicy.forceLogoutAtTime}
                                        onChange={(v) => setPolicy({ ...policy, sessionPolicy: { ...policy.sessionPolicy, forceLogoutAtTime: v } })}
                                        type="time"
                                        helper="Dejar vacío para desactivar"
                                    />
                                </FormSection>
                            )}

                            {/* Profile Requirements */}
                            {activeSection === 'profile' && (
                                <FormSection title="Requisitos de Perfil" description="Campos obligatorios del perfil" icon={<UserCog className="w-5 h-5 text-violet-400" />}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ToggleField
                                            label="Requiere vincular Telegram"
                                            description="El agente debe vincular su cuenta de Telegram"
                                            checked={policy.profileRequirements.requireTelegramLink}
                                            onChange={(v) => setPolicy({ ...policy, profileRequirements: { ...policy.profileRequirements, requireTelegramLink: v } })}
                                        />
                                        <ToggleField
                                            label="Requiere MFA habilitado"
                                            description="El agente debe tener MFA configurado"
                                            checked={policy.profileRequirements.requireMFAEnabled}
                                            onChange={(v) => setPolicy({ ...policy, profileRequirements: { ...policy.profileRequirements, requireMFAEnabled: v } })}
                                        />
                                        <ToggleField
                                            label="Requiere nombre"
                                            description="El agente debe tener nombre configurado"
                                            checked={policy.profileRequirements.requireDisplayName}
                                            onChange={(v) => setPolicy({ ...policy, profileRequirements: { ...policy.profileRequirements, requireDisplayName: v } })}
                                        />
                                        <ToggleField
                                            label="Requiere avatar"
                                            description="El agente debe tener foto de perfil"
                                            checked={policy.profileRequirements.requireAvatar}
                                            onChange={(v) => setPolicy({ ...policy, profileRequirements: { ...policy.profileRequirements, requireAvatar: v } })}
                                        />
                                    </div>

                                    <ToggleField
                                        label="Bloquear hasta completar perfil"
                                        description="Impedir acceso al dashboard hasta que el perfil esté completo"
                                        checked={policy.profileRequirements.blockUntilComplete}
                                        onChange={(v) => setPolicy({ ...policy, profileRequirements: { ...policy.profileRequirements, blockUntilComplete: v } })}
                                    />
                                </FormSection>
                            )}

                            {/* Auto Status */}
                            {activeSection === 'status' && (
                                <FormSection title="Estado Automático" description="Configuración de estado al iniciar sesión" icon={<Zap className="w-5 h-5 text-yellow-400" />}>
                                    <ToggleField
                                        label="Estado automático al iniciar sesión"
                                        description="Establecer estado automáticamente cuando el agente inicia sesión"
                                        checked={policy.autoStatus.enabled}
                                        onChange={(v) => setPolicy({ ...policy, autoStatus: { ...policy.autoStatus, enabled: v } })}
                                    />

                                    {policy.autoStatus.enabled && (
                                        <>
                                            <SelectField
                                                label="Estado por defecto al login"
                                                value={policy.autoStatus.defaultStatusOnLogin}
                                                onChange={(v) => setPolicy({ ...policy, autoStatus: { ...policy.autoStatus, defaultStatusOnLogin: v as any } })}
                                                options={[
                                                    { value: 'online', label: '🟢 Online' },
                                                    { value: 'away', label: '🟡 Ausente' },
                                                    { value: 'busy', label: '🔴 Ocupado' },
                                                ]}
                                            />

                                            <SelectField
                                                label="Estado fuera de horario laboral"
                                                value={policy.autoStatus.statusOutsideHours}
                                                onChange={(v) => setPolicy({ ...policy, autoStatus: { ...policy.autoStatus, statusOutsideHours: v as any } })}
                                                options={[
                                                    { value: 'away', label: '🟡 Ausente' },
                                                    { value: 'offline', label: '⚫ Offline' },
                                                ]}
                                            />

                                            <ToggleField
                                                label="Establecer offline al cerrar sesión"
                                                description="Cambiar estado a offline cuando el agente cierra sesión"
                                                checked={policy.autoStatus.setOfflineOnLogout}
                                                onChange={(v) => setPolicy({ ...policy, autoStatus: { ...policy.autoStatus, setOfflineOnLogout: v } })}
                                            />
                                        </>
                                    )}
                                </FormSection>
                            )}

                            {/* Global Alerts */}
                            {activeSection === 'alerts' && (
                                <FormSection title="Alerta Global" description="Mensaje para todos los agentes" icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}>
                                    <ToggleField
                                        label="Mostrar alerta global"
                                        description="Mostrar un mensaje importante a todos los agentes al iniciar sesión"
                                        checked={policy.globalAlert.enabled}
                                        onChange={(v) => setPolicy({ ...policy, globalAlert: { ...policy.globalAlert, enabled: v } })}
                                    />

                                    {policy.globalAlert.enabled && (
                                        <>
                                            <InputField
                                                label="Título"
                                                value={policy.globalAlert.title}
                                                onChange={(v) => setPolicy({ ...policy, globalAlert: { ...policy.globalAlert, title: v } })}
                                                placeholder="Aviso importante"
                                            />

                                            <div>
                                                <label className="text-sm font-medium text-zinc-300 mb-2 block">Mensaje</label>
                                                <textarea
                                                    value={policy.globalAlert.message}
                                                    onChange={(e) => setPolicy({ ...policy, globalAlert: { ...policy.globalAlert, message: e.target.value } })}
                                                    placeholder="Contenido del mensaje..."
                                                    rows={4}
                                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-50 placeholder-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                                                />
                                            </div>

                                            <SelectField
                                                label="Tipo de alerta"
                                                value={policy.globalAlert.type}
                                                onChange={(v) => setPolicy({ ...policy, globalAlert: { ...policy.globalAlert, type: v as any } })}
                                                options={[
                                                    { value: 'info', label: 'ℹ️ Información' },
                                                    { value: 'warning', label: '⚠️ Advertencia' },
                                                    { value: 'critical', label: '🚨 Crítico' },
                                                ]}
                                            />

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <ToggleField
                                                    label="Requerir confirmación"
                                                    description="El agente debe confirmar que leyó el mensaje"
                                                    checked={policy.globalAlert.requireAcknowledge}
                                                    onChange={(v) => setPolicy({ ...policy, globalAlert: { ...policy.globalAlert, requireAcknowledge: v } })}
                                                />
                                                <ToggleField
                                                    label="Mostrar pantalla completa"
                                                    description="Bloquear acceso hasta confirmar"
                                                    checked={policy.globalAlert.showFullScreen}
                                                    onChange={(v) => setPolicy({ ...policy, globalAlert: { ...policy.globalAlert, showFullScreen: v } })}
                                                />
                                            </div>
                                        </>
                                    )}
                                </FormSection>
                            )}

                            {/* Maintenance Mode */}
                            {activeSection === 'maintenance' && (
                                <FormSection title="Modo Mantenimiento" description="Restringir acceso durante mantenimiento" icon={<Settings2 className="w-5 h-5 text-gray-400" />}>
                                    <ToggleField
                                        label="Activar modo mantenimiento"
                                        description="Restringir acceso al sistema para la mayoría de los agentes"
                                        checked={policy.maintenanceMode.enabled}
                                        onChange={(v) => setPolicy({ ...policy, maintenanceMode: { ...policy.maintenanceMode, enabled: v } })}
                                    />

                                    {policy.maintenanceMode.enabled && (
                                        <>
                                            <RoleSelector
                                                label="Roles con acceso completo durante mantenimiento"
                                                selected={policy.maintenanceMode.allowedRoles}
                                                onChange={(roles) => setPolicy({ ...policy, maintenanceMode: { ...policy.maintenanceMode, allowedRoles: roles } })}
                                            />

                                            <ToggleField
                                                label="Solo lectura para otros"
                                                description="Permitir ver pero no interactuar"
                                                checked={policy.maintenanceMode.readOnlyForOthers}
                                                onChange={(v) => setPolicy({ ...policy, maintenanceMode: { ...policy.maintenanceMode, readOnlyForOthers: v } })}
                                            />

                                            <InputField
                                                label="Mensaje de mantenimiento"
                                                value={policy.maintenanceMode.message}
                                                onChange={(v) => setPolicy({ ...policy, maintenanceMode: { ...policy.maintenanceMode, message: v } })}
                                                placeholder="El sistema está en mantenimiento..."
                                            />
                                        </>
                                    )}
                                </FormSection>
                            )}

                            {/* Supervisor Alerts */}
                            {activeSection === 'supervisor_alerts' && (
                                <FormSection title="Alertas a Supervisores" description="Notificaciones automáticas de seguridad" icon={<Bell className="w-5 h-5 text-pink-400" />}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ToggleField
                                            label="Login fuera de horario"
                                            description="Notificar cuando un agente intenta login fuera del horario"
                                            checked={policy.supervisorAlerts.onLoginOutsideHours}
                                            onChange={(v) => setPolicy({ ...policy, supervisorAlerts: { ...policy.supervisorAlerts, onLoginOutsideHours: v } })}
                                        />
                                        <ToggleField
                                            label="Dispositivo nuevo"
                                            description="Notificar cuando se detecta un dispositivo nuevo"
                                            checked={policy.supervisorAlerts.onNewDeviceLogin}
                                            onChange={(v) => setPolicy({ ...policy, supervisorAlerts: { ...policy.supervisorAlerts, onNewDeviceLogin: v } })}
                                        />
                                        <ToggleField
                                            label="Login bloqueado"
                                            description="Notificar cuando se bloquea un intento de login"
                                            checked={policy.supervisorAlerts.onBlockedLogin}
                                            onChange={(v) => setPolicy({ ...policy, supervisorAlerts: { ...policy.supervisorAlerts, onBlockedLogin: v } })}
                                        />
                                        <ToggleField
                                            label="Actividad sospechosa"
                                            description="Notificar comportamiento inusual"
                                            checked={policy.supervisorAlerts.onSuspiciousActivity}
                                            onChange={(v) => setPolicy({ ...policy, supervisorAlerts: { ...policy.supervisorAlerts, onSuspiciousActivity: v } })}
                                        />
                                        <ToggleField
                                            label="Múltiples intentos fallidos"
                                            description="Notificar cuando hay múltiples intentos de login fallidos"
                                            checked={policy.supervisorAlerts.onMultipleFailedAttempts}
                                            onChange={(v) => setPolicy({ ...policy, supervisorAlerts: { ...policy.supervisorAlerts, onMultipleFailedAttempts: v } })}
                                        />
                                    </div>
                                </FormSection>
                            )}

                            {/* Chat Action Rules */}
                            {activeSection === 'chat_rules' && (
                                <div className="space-y-6">
                                    <FormSection title="Reglas de Acciones en Chat" description="Restricciones para acciones dentro del chat" icon={<MessageSquare className="w-5 h-5 text-emerald-400" />}>
                                        <p className="text-sm text-zinc-400 mb-4">
                                            Define reglas que los agentes deben cumplir antes de realizar ciertas acciones en los chats.
                                        </p>

                                        {/* Existing Rules */}
                                        <div className="space-y-3">
                                            {(policy.chatActionRules || []).map((rule) => (
                                                <div
                                                    key={rule.id}
                                                    className={`p-4 rounded-xl border transition-all ${rule.enabled
                                                            ? 'bg-zinc-800/50 border-zinc-700'
                                                            : 'bg-zinc-900/50 border-zinc-800 opacity-60'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleRule(rule.id)}
                                                                className={`p-1.5 rounded-lg transition-colors ${rule.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'
                                                                    }`}
                                                            >
                                                                {rule.enabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                            </button>
                                                            <div>
                                                                <p className="font-medium text-zinc-50">{rule.name}</p>
                                                                <p className="text-xs text-zinc-500">
                                                                    Acción: {rule.action} • Condición: {rule.condition.type}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingRule(rule)}
                                                                className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-700 rounded-lg transition-colors"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteRule(rule.id)}
                                                                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {rule.errorMessage && (
                                                        <p className="text-xs text-amber-400/80 mt-2 pl-10">
                                                            ⚠️ {rule.errorMessage}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add/Edit Rule */}
                                        {(showNewRule || editingRule) && (
                                            <ChatRuleEditor
                                                rule={editingRule || undefined}
                                                onSave={handleSaveRule}
                                                onCancel={() => {
                                                    setShowNewRule(false);
                                                    setEditingRule(null);
                                                }}
                                            />
                                        )}

                                        {!showNewRule && !editingRule && (
                                            <button
                                                type="button"
                                                onClick={() => setShowNewRule(true)}
                                                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:text-zinc-50 hover:border-purple-500 transition-all"
                                            >
                                                <Plus className="w-5 h-5" />
                                                <span>Añadir nueva regla</span>
                                            </button>
                                        )}
                                    </FormSection>

                                    {/* Quick Presets */}
                                    <FormSection title="Reglas Predefinidas" description="Activar reglas comunes rápidamente" icon={<ClipboardList className="w-5 h-5 text-blue-400" />}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleSaveRule({
                                                    id: `preset_close_note_${Date.now()}`,
                                                    name: 'Cerrar chat requiere nota',
                                                    enabled: true,
                                                    action: 'close_chat',
                                                    condition: { type: 'require_note', minNoteLength: 10 },
                                                    errorMessage: 'Debes agregar una nota antes de cerrar el chat',
                                                    bypassRoles: ['admin'],
                                                })}
                                                className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl hover:border-purple-500 transition-all text-left"
                                            >
                                                <div className="flex items-center gap-2 text-zinc-50 font-medium mb-1">
                                                    <FileText className="w-4 h-4 text-blue-400" />
                                                    Cerrar requiere nota
                                                </div>
                                                <p className="text-xs text-zinc-500">El agente debe escribir una nota antes de cerrar</p>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleSaveRule({
                                                    id: `preset_transfer_sup_${Date.now()}`,
                                                    name: 'Solo supervisores transfieren',
                                                    enabled: true,
                                                    action: 'transfer_chat',
                                                    condition: { type: 'role_restriction', roles: ['supervisor', 'admin'] },
                                                    errorMessage: 'Solo supervisores pueden transferir chats',
                                                    bypassRoles: ['admin'],
                                                })}
                                                className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl hover:border-purple-500 transition-all text-left"
                                            >
                                                <div className="flex items-center gap-2 text-zinc-50 font-medium mb-1">
                                                    <Shield className="w-4 h-4 text-amber-400" />
                                                    Transferir solo supervisores
                                                </div>
                                                <p className="text-xs text-zinc-500">Limita la transferencia a supervisores</p>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleSaveRule({
                                                    id: `preset_close_tag_${Date.now()}`,
                                                    name: 'Cerrar requiere etiqueta',
                                                    enabled: true,
                                                    action: 'close_chat',
                                                    condition: { type: 'require_tag', requiredTags: ['resuelto', 'spam', 'duplicado'] },
                                                    errorMessage: 'Debes agregar una etiqueta de resolución',
                                                    bypassRoles: ['admin'],
                                                })}
                                                className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl hover:border-purple-500 transition-all text-left"
                                            >
                                                <div className="flex items-center gap-2 text-zinc-50 font-medium mb-1">
                                                    <Tag className="w-4 h-4 text-green-400" />
                                                    Cerrar requiere etiqueta
                                                </div>
                                                <p className="text-xs text-zinc-500">El chat debe tener una etiqueta de resolución</p>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleSaveRule({
                                                    id: `preset_block_approval_${Date.now()}`,
                                                    name: 'Bloquear requiere aprobación',
                                                    enabled: true,
                                                    action: 'block_user',
                                                    condition: { type: 'require_approval', approvalRoles: ['supervisor', 'admin'] },
                                                    errorMessage: 'Bloquear usuarios requiere aprobación de un supervisor',
                                                    bypassRoles: ['admin'],
                                                })}
                                                className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl hover:border-purple-500 transition-all text-left"
                                            >
                                                <div className="flex items-center gap-2 text-zinc-50 font-medium mb-1">
                                                    <Ban className="w-4 h-4 text-red-400" />
                                                    Bloquear con aprobación
                                                </div>
                                                <p className="text-xs text-zinc-500">Requiere aprobación de supervisor para bloquear</p>
                                            </button>
                                        </div>
                                    </FormSection>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
