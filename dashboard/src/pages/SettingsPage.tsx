/**
 * SettingsPage - Modern UI for system configuration
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  Settings,
  Bot,
  MessageSquare,
  Users,
  Shield,
  Save,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Globe,
  Bell,
  Zap,
  Lock,
  Key,
  Mail,
  Palette,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Sparkles,
  FileText,
  UserCog,
  Volume2,
  Smartphone,
  Timer,
  Eye,
  EyeOff,
  UserX,
  ShieldCheck,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';

type SettingsTab = 'bot' | 'chat' | 'agents' | 'security' | 'notifications';

interface BotSettings {
  botName: string;
  welcomeMessage: string;
  offlineMessage: string;
  language: string;
  autoReplyEnabled: boolean;
  autoReplyDelay: number;
  typingIndicator: boolean;
}

interface ChatSettings {
  maxQueueSize: number;
  queueTimeout: number;
  inactivityTimeout: number;
  enableFileSharing: boolean;
  maxFileSize: number;
  allowedFileTypes: string[];
  enableEmoji: boolean;
  enableSuggestions: boolean;
}

interface AgentSettings {
  defaultMaxChats: number;
  autoAssign: boolean;
  roundRobinEnabled: boolean;
  skillBasedRouting: boolean;
  priorityRouting: boolean;
  workingHoursEnabled: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  focusModeEnabled: boolean;
}

interface SecuritySettings {
  sessionTimeout: number;
  maxLoginAttempts: number;
  maxSessionsPerAgent: number;
  twoFactorEnabled: boolean;
  ipWhitelistEnabled: boolean;
  ipWhitelist: string[];
  auditLogRetention: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecial: boolean;
  };
  // MFA Settings
  mfaRequiredForAll: boolean;
  mfaRequiredRoles: string[];
  mfaBypassIPs: string[];
  mfaTrustDevicesEnabled: boolean;
  mfaAllowedMethods: ('telegram' | 'totp')[];
  // Auto-Lock Settings
  autoLockEnabled: boolean;
  autoLockTimeoutMinutes: number;
  autoLockRequirePassword: boolean;
  autoLockRequireMFA: boolean;
  autoLockShowLastActivity: boolean;
  autoLockGracePeriodSeconds: number;
  autoLockRoleTimeouts: {
    admin: number;
    supervisor: number;
    agent: number;
  };
  autoLockExemptRoles: string[];
}

interface NotificationSettings {
  emailNotifications: boolean;
  newChatSound: boolean;
  newMessageSound: boolean;
  desktopNotifications: boolean;
  escalationAlerts: boolean;
  dailyReportEmail: boolean;
}

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'bot', label: 'Bot', icon: <Bot className="w-5 h-5" />, description: 'Respuestas automáticas' },
  { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" />, description: 'Reglas de conversación' },
  { id: 'agents', label: 'Agentes', icon: <Users className="w-5 h-5" />, description: 'Asignación y horarios' },
  { id: 'security', label: 'Seguridad', icon: <Shield className="w-5 h-5" />, description: 'Acceso y auditoría' },
  { id: 'notifications', label: 'Notificaciones', icon: <Bell className="w-5 h-5" />, description: 'Alertas del sistema' },
];

// Link to Agent Rules page
const AgentRulesLink = () => (
  <Link 
    to="/agent-rules"
    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent hover:border-purple-500/30"
  >
    <div className="p-2 rounded-lg bg-zinc-800 text-zinc-500 group-hover:text-purple-400 group-hover:bg-purple-500/20 transition-colors">
      <ShieldCheck className="w-5 h-5" />
    </div>
    <div className="text-left flex-1">
      <p className="font-medium text-sm group-hover:text-zinc-50">Reglas de Agentes</p>
      <p className="text-[10px] text-zinc-500 line-clamp-1">Políticas de login y chat</p>
    </div>
    <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-purple-400" />
  </Link>
);

const DispositionsLink = () => (
  <Link
    to="/dispositions"
    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent hover:border-purple-500/30"
  >
    <div className="p-2 rounded-lg bg-zinc-800 text-zinc-500 group-hover:text-purple-400 group-hover:bg-purple-500/20 transition-colors">
      <FileText className="w-5 h-5" />
    </div>
    <div className="text-left flex-1">
      <p className="font-medium text-sm group-hover:text-zinc-50">Tipificaciones</p>
      <p className="text-[10px] text-zinc-500 line-clamp-1">Categorías y motivos de cierre</p>
    </div>
    <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-purple-400" />
  </Link>
);

const defaultBotSettings: BotSettings = {
  botName: 'Asistente',
  welcomeMessage: '¡Hola! ¿En qué puedo ayudarte?',
  offlineMessage: 'No hay agentes disponibles. Te responderemos pronto.',
  language: 'es',
  autoReplyEnabled: true,
  autoReplyDelay: 1000,
  typingIndicator: true,
};

const defaultChatSettings: ChatSettings = {
  maxQueueSize: 50,
  queueTimeout: 300,
  inactivityTimeout: 600,
  enableFileSharing: true,
  maxFileSize: 10,
  allowedFileTypes: ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'],
  enableEmoji: true,
  enableSuggestions: true,
};

const defaultAgentSettings: AgentSettings = {
  defaultMaxChats: 5,
  autoAssign: true,
  roundRobinEnabled: true,
  skillBasedRouting: true,
  priorityRouting: false,
  workingHoursEnabled: false,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  focusModeEnabled: false,
};

const defaultSecuritySettings: SecuritySettings = {
  sessionTimeout: 480,
  maxLoginAttempts: 5,
  maxSessionsPerAgent: 3,
  twoFactorEnabled: false,
  ipWhitelistEnabled: false,
  ipWhitelist: [],
  auditLogRetention: 90,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecial: false,
  },
  // MFA Settings
  mfaRequiredForAll: false,
  mfaRequiredRoles: ['admin', 'supervisor'],
  mfaBypassIPs: [],
  mfaTrustDevicesEnabled: true,
  mfaAllowedMethods: ['telegram', 'totp'],
  // Auto-Lock Settings
  autoLockEnabled: false,
  autoLockTimeoutMinutes: 15,
  autoLockRequirePassword: true,
  autoLockRequireMFA: false,
  autoLockShowLastActivity: true,
  autoLockGracePeriodSeconds: 30,
  autoLockRoleTimeouts: {
    admin: 5,
    supervisor: 10,
    agent: 15,
  },
  autoLockExemptRoles: [],
};

const defaultNotificationSettings: NotificationSettings = {
  emailNotifications: true,
  newChatSound: true,
  newMessageSound: true,
  desktopNotifications: true,
  escalationAlerts: true,
  dailyReportEmail: false,
};

export default function SettingsPage() {
  const token = useAuthStore((state) => state.token);
  const [activeTab, setActiveTab] = useState<SettingsTab>('bot');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [botSettings, setBotSettings] = useState<BotSettings>(defaultBotSettings);
  const [chatSettings, setChatSettings] = useState<ChatSettings>(defaultChatSettings);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(defaultAgentSettings);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(defaultSecuritySettings);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(defaultNotificationSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok && data.settings) {
        setBotSettings({ ...defaultBotSettings, ...data.settings.bot });
        setChatSettings({ ...defaultChatSettings, ...data.settings.chat });
        setAgentSettings({ ...defaultAgentSettings, ...data.settings.agents });
        setSecuritySettings({ ...defaultSecuritySettings, ...data.settings.security });
        setNotificationSettings({ ...defaultNotificationSettings, ...data.settings.notifications });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bot: botSettings,
          chat: chatSettings,
          agents: agentSettings,
          security: securitySettings,
          notifications: notificationSettings,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
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
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-0">

        {/* Header Section */}
        <div className="px-8 py-6 pb-2 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm z-20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              {/* back button */}
             
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-purple-900/10">
                <Settings className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Configuración</h1>
                <p className="text-sm text-zinc-400">Preferencias generales del sistema</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {saveSuccess && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                  <CheckCircle className="w-4 h-4" /> Guardado
                </div>
              )}

              <button
                onClick={loadSettings}
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

          {/* Sidebar Tabs */}
          <div className="w-72 border-r border-zinc-800 bg-zinc-900/30 p-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === tab.id
                    ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'
                  }`}
              >
                <div className={`p-2 rounded-lg transition-colors ${activeTab === tab.id ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'}`}>
                  {tab.icon}
                </div>
                <div className="text-left flex-1">
                  <p className={`font-medium text-sm ${activeTab === tab.id ? 'text-zinc-50' : ''}`}>{tab.label}</p>
                  <p className="text-[10px] text-zinc-500 line-clamp-1">{tab.description}</p>
                </div>
                {activeTab === tab.id && <ChevronRight className="w-4 h-4 text-purple-500/50" />}
              </button>
            ))}
            
            {/* Separator */}
            <div className="my-3 border-t border-zinc-800/50" />
            
            {/* Link to Agent Rules Page */}
            <AgentRulesLink />
            <DispositionsLink />
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar bg-zinc-950/50">
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeTab === 'bot' && <BotSettingsForm settings={botSettings} setSettings={setBotSettings} />}
              {activeTab === 'chat' && <ChatSettingsForm settings={chatSettings} setSettings={setChatSettings} />}
              {activeTab === 'agents' && <AgentSettingsForm settings={agentSettings} setSettings={setAgentSettings} />}
              {activeTab === 'security' && <SecuritySettingsForm settings={securitySettings} setSettings={setSecuritySettings} />}
              {activeTab === 'notifications' && <NotificationSettingsForm settings={notificationSettings} setSettings={setNotificationSettings} />}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Form Components

function FormSection({ title, description, icon, children }: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/60 flex items-center gap-3">
        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400 border border-zinc-700/50">{icon}</div>
        <div>
          <h3 className="text-base font-semibold text-zinc-50">{title}</h3>
          {description && <p className="text-xs text-zinc-500">{description}</p>}
        </div>
      </div>
      <div className="p-6 space-y-6">
        {children}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder, suffix, min, max, helper }: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
  helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-2 ">{label}</label>
      <div className="relative group">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min} max={max}
          className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
        />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">{suffix}</span>}
      </div>
      {helper && <p className="mt-1.5 text-xs text-zinc-500 flex items-center gap-1"><InfoIcon className="w-3 h-3" /> {helper}</p>}
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 3 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-2 ">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none text-sm leading-relaxed"
      />
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
      <div className="pr-4">
        <p className="font-medium text-sm text-zinc-200">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
      </label>
    </div>
  );
}
function SelectField({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-2 ">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 appearance-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm cursor-pointer"
        >
          {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 rotate-90 pointer-events-none" />
      </div>
    </div>
  );
}

const InfoIcon = (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

// Settings Forms

function BotSettingsForm({ settings, setSettings }: {
  settings: BotSettings;
  setSettings: (settings: BotSettings) => void;
}) {
  return (
    <div className="space-y-8">
      <FormSection title="Identidad del Bot" description="Configura cómo se presenta el bot ante los usuarios" icon={<Bot className="w-5 h-5 text-purple-400" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField label="Nombre del Bot" value={settings.botName} onChange={(v: any) => setSettings({ ...settings, botName: v })} placeholder="Ej: Asistente Virtual" />
          <SelectField label="Idioma Predeterminado" value={settings.language} onChange={(v: any) => setSettings({ ...settings, language: v })} options={[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' }]} />
        </div>
      </FormSection>
      <FormSection title="Mensajes Automáticos" description="Personaliza los mensajes que envía el sistema" icon={<MessageSquare className="w-5 h-5 text-purple-400" />}>
        <TextareaField label="Bienvenida" value={settings.welcomeMessage} onChange={(v: any) => setSettings({ ...settings, welcomeMessage: v })} placeholder="Mensaje inicial..." />
        <TextareaField label="Fuera de Horario" value={settings.offlineMessage} onChange={(v: any) => setSettings({ ...settings, offlineMessage: v })} placeholder="Mensaje cuando no hay agentes..." />
      </FormSection>
      <FormSection title="Comportamiento" description="Ajustes de interacción" icon={<Zap className="w-5 h-5 text-purple-400" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleField label="Respuestas Automáticas" description="Permitir respuestas del bot" checked={settings.autoReplyEnabled} onChange={(v: any) => setSettings({ ...settings, autoReplyEnabled: v })} />
          <ToggleField label="Indicador de Escritura" description="Simular escritura humana" checked={settings.typingIndicator} onChange={(v: any) => setSettings({ ...settings, typingIndicator: v })} />
        </div>
        {settings.autoReplyEnabled && (
          <div className="mt-4">
            <InputField label="Delay de Respuesta" value={settings.autoReplyDelay} onChange={(v: any) => setSettings({ ...settings, autoReplyDelay: parseInt(v) || 0 })} type="number" suffix="ms" min={0} max={5000} />
          </div>
        )}
      </FormSection>
    </div>
  );
}

function ChatSettingsForm({ settings, setSettings }: {
  settings: ChatSettings;
  setSettings: (settings: ChatSettings) => void;
}) {
  return (
    <div className="space-y-8">
      <FormSection title="Gestión de Cola" description="Parámetros para la espera de clientes" icon={<Clock className="w-5 h-5 text-blue-400" />}>
        <div className="grid grid-cols-2 gap-6">
          <InputField label="Tamaño Máximo de Cola" value={settings.maxQueueSize} onChange={(v: any) => setSettings({ ...settings, maxQueueSize: parseInt(v) || 50 })} type="number" suffix="chats" />
          <InputField label="Tiempo Máximo de Espera" value={settings.queueTimeout} onChange={(v: any) => setSettings({ ...settings, queueTimeout: parseInt(v) || 300 })} type="number" suffix="seg" />
        </div>
        <InputField label="Timeout de Inactividad" value={settings.inactivityTimeout} onChange={(v: any) => setSettings({ ...settings, inactivityTimeout: parseInt(v) || 600 })} type="number" suffix="seg" helper="Tiempo antes de cerrar un chat inactivo automáticamente." />
      </FormSection>
      <FormSection title="Archivos y Medios" description="Restricciones de contenido multimedia" icon={<FileText className="w-5 h-5 text-blue-400" />}>
        <ToggleField label="Habilitar Archivos" description="Permitir subir archivos" checked={settings.enableFileSharing} onChange={(v: any) => setSettings({ ...settings, enableFileSharing: v })} />
        {settings.enableFileSharing && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Tamaño Máximo" value={settings.maxFileSize} onChange={(v: any) => setSettings({ ...settings, maxFileSize: parseInt(v) || 10 })} type="number" suffix="MB" />
            <InputField label="Extensiones Permitidas" value={settings.allowedFileTypes.join(', ')} onChange={(e: any) => setSettings({ ...settings, allowedFileTypes: e.target.value.split(',').map((t: any) => t.trim()).filter(Boolean) })} placeholder="pdf, jpg, png..." />
          </div>
        )}
      </FormSection>
    </div>
  );
}

function AgentSettingsForm({ settings, setSettings }: {
  settings: AgentSettings;
  setSettings: (settings: AgentSettings) => void;
}) {
  console.log('AgentSettingsForm render', settings);
  return (
    <div className="space-y-8">
      <FormSection title="Asignación de Chats" description="Reglas de distribución de trabajo" icon={<UserCog className="w-5 h-5 text-emerald-400" />}>
        <InputField label="Chats Máximos por Agente" value={settings.defaultMaxChats} onChange={(v: any) => setSettings({ ...settings, defaultMaxChats: parseInt(v) || 5 })} type="number" min={1} max={20} />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleField label="Asignación Automática" checked={settings.autoAssign} onChange={(v: any) => setSettings({ ...settings, autoAssign: v })} />
          {settings.autoAssign && <ToggleField label="Round Robin" description="Distribución equitativa" checked={settings.roundRobinEnabled} onChange={(v: any) => setSettings({ ...settings, roundRobinEnabled: v })} />}
        </div>
        <ToggleField label="Habilitar Modo de Enfoque" checked={settings.focusModeEnabled} onChange={(v: any) => {console.log('Focus mode enabled changed:', v); setSettings({ ...settings, focusModeEnabled: v })}} />
      </FormSection>
      <FormSection title="Horarios" description="Control de disponibilidad" icon={<Clock className="w-5 h-5 text-emerald-400" />}>
        <ToggleField label="Restricción Horaria" checked={settings.workingHoursEnabled} onChange={(v: any) => setSettings({ ...settings, workingHoursEnabled: v })} />
        {settings.workingHoursEnabled && (
          <div className="mt-4 grid grid-cols-2 gap-6">
            <InputField label="Inicio" value={settings.workingHoursStart} onChange={(v: any) => setSettings({ ...settings, workingHoursStart: v })} type="time" />
            <InputField label="Fin" value={settings.workingHoursEnd} onChange={(v: any) => setSettings({ ...settings, workingHoursEnd: v })} type="time" />
          </div>
        )}
      </FormSection>
      <FormSection title="Modo de Enfoque" description="Configuración del modo de enfoque para agentes" icon={<Eye className="w-5 h-5 text-emerald-400" />}>
        <ToggleField label="Habilitar Modo de Enfoque" checked={settings.focusModeEnabled} onChange={(v: any) => {console.log('Focus mode enabled changed:', v); setSettings({ ...settings, focusModeEnabled: !v })}} />
      </FormSection>
    </div>
  );
}

function SecuritySettingsForm({ settings, setSettings }: {
  settings: SecuritySettings;
  setSettings: (settings: SecuritySettings) => void;
}) {
  // Toggle role in mfaRequiredRoles array
  const toggleRole = (role: string) => {
    const currentRoles = settings.mfaRequiredRoles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    setSettings({ ...settings, mfaRequiredRoles: newRoles });
  };

  // Toggle MFA method
  const toggleMethod = (method: 'telegram' | 'totp') => {
    const currentMethods = settings.mfaAllowedMethods || ['telegram', 'totp'];
    const newMethods = currentMethods.includes(method)
      ? currentMethods.filter(m => m !== method)
      : [...currentMethods, method] as ('telegram' | 'totp')[];
    // Ensure at least one method is always selected
    if (newMethods.length === 0) return;
    setSettings({ ...settings, mfaAllowedMethods: newMethods });
  };

  return (
    <div className="space-y-8">
      <FormSection title="Sesiones y Acceso" description="Control de seguridad de cuentas" icon={<Shield className="w-5 h-5 text-red-400" />}>
        <div className="grid grid-cols-2 gap-6">
          <InputField label="Timeout de Sesión (min)" value={settings.sessionTimeout} onChange={(v: any) => setSettings({ ...settings, sessionTimeout: parseInt(v) || 480 })} type="number" />
          <InputField label="Max Intentos Login" value={settings.maxLoginAttempts} onChange={(v: any) => setSettings({ ...settings, maxLoginAttempts: parseInt(v) || 5 })} type="number" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-6">
          <InputField label="Max Sesiones por Agente" value={settings.maxSessionsPerAgent} onChange={(v: any) => setSettings({ ...settings, maxSessionsPerAgent: parseInt(v) || 3 })} type="number" />
          <InputField label="Retención Auditoría (días)" value={settings.auditLogRetention} onChange={(v: any) => setSettings({ ...settings, auditLogRetention: parseInt(v) || 90 })} type="number" />
        </div>
      </FormSection>

      <FormSection title="Autenticación Multifactor (MFA)" description="Configuración de segundo factor de autenticación" icon={<Lock className="w-5 h-5 text-red-400" />}>
        <div className="space-y-4">
          <ToggleField 
            label="Requerir MFA para todos" 
            description="Todos los usuarios deben configurar MFA" 
            checked={settings.mfaRequiredForAll} 
            onChange={(v: any) => setSettings({ ...settings, mfaRequiredForAll: v })} 
          />
          
          {!settings.mfaRequiredForAll && (
            <div className="mt-4">
              <label className="text-sm font-medium text-zinc-300 mb-3 block">
                Roles que requieren MFA
              </label>
              <div className="flex flex-wrap gap-2">
                {['admin', 'supervisor', 'support'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      settings.mfaRequiredRoles?.includes(role)
                        ? 'bg-purple-600 text-zinc-50'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {role === 'admin' ? 'Administradores' : role === 'supervisor' ? 'Supervisores' : 'Soporte'}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-zinc-800">
            <label className="text-sm font-medium text-zinc-300 mb-3 block">
              Métodos de MFA permitidos
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleMethod('telegram')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  settings.mfaAllowedMethods?.includes('telegram')
                    ? 'bg-blue-600 text-zinc-50'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Telegram
              </button>
              <button
                type="button"
                onClick={() => toggleMethod('totp')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  settings.mfaAllowedMethods?.includes('totp')
                    ? 'bg-emerald-600 text-zinc-50'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                App Autenticador (TOTP)
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800">
            <ToggleField 
              label="Confiar en dispositivos" 
              description="Permite recordar dispositivos verificados por 30 días" 
              checked={settings.mfaTrustDevicesEnabled} 
              onChange={(v: any) => setSettings({ ...settings, mfaTrustDevicesEnabled: v })} 
            />
          </div>
        </div>
      </FormSection>

      {/* Auto-Lock Section */}
      <FormSection title="Bloqueo Automático por Inactividad" description="Protección cuando el usuario está ausente" icon={<Timer className="w-5 h-5 text-red-400" />}>
        <div className="space-y-4">
          <ToggleField 
            label="Habilitar bloqueo automático" 
            description="Bloquea la sesión después de un período de inactividad" 
            checked={settings.autoLockEnabled} 
            onChange={(v: any) => setSettings({ ...settings, autoLockEnabled: v })} 
          />
          
          {settings.autoLockEnabled && (
            <>
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <label className="text-sm font-medium text-zinc-300 mb-3 block">
                  Timeout por rol (minutos)
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Admin</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.autoLockRoleTimeouts?.admin ?? 5}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoLockRoleTimeouts: {
                          ...settings.autoLockRoleTimeouts,
                          admin: parseInt(e.target.value) || 5,
                        }
                      })}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Supervisor</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.autoLockRoleTimeouts?.supervisor ?? 10}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoLockRoleTimeouts: {
                          ...settings.autoLockRoleTimeouts,
                          supervisor: parseInt(e.target.value) || 10,
                        }
                      })}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Agente</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.autoLockRoleTimeouts?.agent ?? 15}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoLockRoleTimeouts: {
                          ...settings.autoLockRoleTimeouts,
                          agent: parseInt(e.target.value) || 15,
                        }
                      })}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <label className="text-sm font-medium text-zinc-300 mb-3 block">
                  Período de gracia antes de bloquear
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={settings.autoLockGracePeriodSeconds ?? 30}
                    onChange={(e) => setSettings({ ...settings, autoLockGracePeriodSeconds: parseInt(e.target.value) || 30 })}
                    className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                  />
                  <span className="text-zinc-400 text-sm">segundos (0 = sin aviso)</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <label className="text-sm font-medium text-zinc-300 mb-3 block">
                  Requisitos para desbloquear
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ToggleField 
                    label="Requerir contraseña" 
                    description="El usuario debe ingresar su contraseña" 
                    checked={settings.autoLockRequirePassword} 
                    onChange={(v: any) => setSettings({ ...settings, autoLockRequirePassword: v })} 
                  />
                  <ToggleField 
                    label="Requerir MFA" 
                    description="Verificación adicional de segundo factor" 
                    checked={settings.autoLockRequireMFA} 
                    onChange={(v: any) => setSettings({ ...settings, autoLockRequireMFA: v })} 
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <ToggleField 
                  label="Mostrar última actividad" 
                  description="Muestra cuándo fue la última acción del usuario en la pantalla de bloqueo" 
                  checked={settings.autoLockShowLastActivity} 
                  onChange={(v: any) => setSettings({ ...settings, autoLockShowLastActivity: v })} 
                />
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <label className="text-sm font-medium text-zinc-300 mb-3 block">
                  Roles exentos de bloqueo automático
                </label>
                <div className="flex flex-wrap gap-2">
                  {['admin', 'supervisor', 'support'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        const currentExempt = settings.autoLockExemptRoles || [];
                        const newExempt = currentExempt.includes(role)
                          ? currentExempt.filter(r => r !== role)
                          : [...currentExempt, role];
                        setSettings({ ...settings, autoLockExemptRoles: newExempt });
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        settings.autoLockExemptRoles?.includes(role)
                          ? 'bg-amber-600 text-zinc-50'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      <UserX className="w-4 h-4" />
                      {role === 'admin' ? 'Administradores' : role === 'supervisor' ? 'Supervisores' : 'Soporte'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Los roles seleccionados no serán bloqueados automáticamente
                </p>
              </div>
            </>
          )}
        </div>
      </FormSection>

      <FormSection title="Contraseñas" description="Política de complejidad" icon={<Key className="w-5 h-5 text-red-400" />}>
        <InputField label="Longitud Mínima" value={settings.passwordPolicy.minLength} onChange={(v: any) => setSettings({ ...settings, passwordPolicy: { ...settings.passwordPolicy, minLength: parseInt(v) || 8 } })} type="number" suffix="chars" />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ToggleField label="Mayúsculas" checked={settings.passwordPolicy.requireUppercase} onChange={(v: any) => setSettings({ ...settings, passwordPolicy: { ...settings.passwordPolicy, requireUppercase: v } })} />
          <ToggleField label="Números" checked={settings.passwordPolicy.requireNumbers} onChange={(v: any) => setSettings({ ...settings, passwordPolicy: { ...settings.passwordPolicy, requireNumbers: v } })} />
          <ToggleField label="Especiales" checked={settings.passwordPolicy.requireSpecial} onChange={(v: any) => setSettings({ ...settings, passwordPolicy: { ...settings.passwordPolicy, requireSpecial: v } })} />
        </div>
      </FormSection>
    </div>
  );
}

function NotificationSettingsForm({ settings, setSettings }: {
  settings: NotificationSettings;
  setSettings: (settings: NotificationSettings) => void;
}) {
  return (
    <div className="space-y-8">
      <FormSection title="Canales" description="Dónde recibir alertas" icon={<Mail className="w-5 h-5 text-amber-400" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleField label="Email" description="Alertas críticas por correo" checked={settings.emailNotifications} onChange={(v: any) => setSettings({ ...settings, emailNotifications: v })} />
          <ToggleField label="Escritorio" description="Push notifications del navegador" checked={settings.desktopNotifications} onChange={(v: any) => setSettings({ ...settings, desktopNotifications: v })} />
        </div>
      </FormSection>
      <FormSection title="Sonidos" description="Feedback auditivo" icon={<Volume2 className="w-5 h-5 text-amber-400" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleField label="Nuevo Chat" checked={settings.newChatSound} onChange={(v: any) => setSettings({ ...settings, newChatSound: v })} />
          <ToggleField label="Nuevo Mensaje" checked={settings.newMessageSound} onChange={(v: any) => setSettings({ ...settings, newMessageSound: v })} />
        </div>
      </FormSection>
    </div>
  );
}