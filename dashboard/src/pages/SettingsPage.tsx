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
  Volume2
} from 'lucide-react';

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
}

interface SecuritySettings {
  sessionTimeout: number;
  maxLoginAttempts: number;
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
  { id: 'bot', label: 'Bot', icon: <Bot className="w-5 h-5" />, description: 'Configura el bot de chat' },
  { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-5 h-5" />, description: 'Ajustes de conversación' },
  { id: 'agents', label: 'Agentes', icon: <Users className="w-5 h-5" />, description: 'Reglas para agentes' },
  { id: 'security', label: 'Seguridad', icon: <Shield className="w-5 h-5" />, description: 'Políticas de seguridad' },
  { id: 'notifications', label: 'Notificaciones', icon: <Bell className="w-5 h-5" />, description: 'Alertas y sonidos' },
];

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
};

const defaultSecuritySettings: SecuritySettings = {
  sessionTimeout: 480,
  maxLoginAttempts: 5,
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
            <Settings className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Configuración</h1>
            <p className="text-sm text-gray-400">Ajustes del sistema y preferencias</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl border border-green-500/30">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Guardado exitosamente</span>
            </div>
          )}
          <button
            onClick={loadSettings}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl text-white font-medium transition-all hover:scale-105 shadow-lg shadow-purple-500/25 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-64 border-r border-gray-800 p-4 overflow-y-auto">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white border border-transparent'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  activeTab === tab.id ? 'bg-purple-500/20' : 'bg-gray-800'
                }`}>
                  {tab.icon}
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">{tab.label}</p>
                  <p className="text-xs text-gray-500">{tab.description}</p>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${
                  activeTab === tab.id ? 'rotate-90' : ''
                }`} />
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'bot' && (
            <BotSettingsForm settings={botSettings} setSettings={setBotSettings} />
          )}
          {activeTab === 'chat' && (
            <ChatSettingsForm settings={chatSettings} setSettings={setChatSettings} />
          )}
          {activeTab === 'agents' && (
            <AgentSettingsForm settings={agentSettings} setSettings={setAgentSettings} />
          )}
          {activeTab === 'security' && (
            <SecuritySettingsForm settings={securitySettings} setSettings={setSecuritySettings} />
          )}
          {activeTab === 'notifications' && (
            <NotificationSettingsForm settings={notificationSettings} setSettings={setNotificationSettings} />
          )}
        </div>
      </div>
    </div>
  );
}

// Form Components

function FormSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-3 mb-4">
        {icon && <div className="p-2 bg-gray-800 rounded-lg text-gray-400">{icon}</div>}
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
      </div>
      <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
  min,
  max,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'time';
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
      />
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium text-white">{label}</p>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-14 h-8 rounded-full transition-all ${
          checked ? 'bg-purple-500' : 'bg-gray-600'
        }`}
      >
        <div
          className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${
            checked ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Settings Forms

function BotSettingsForm({
  settings,
  setSettings,
}: {
  settings: BotSettings;
  setSettings: (settings: BotSettings) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection title="Información del Bot" description="Configura la identidad del bot" icon={<Bot className="w-5 h-5" />}>
        <InputField
          label="Nombre del Bot"
          value={settings.botName}
          onChange={(v) => setSettings({ ...settings, botName: v })}
          placeholder="Asistente"
        />
        <SelectField
          label="Idioma"
          value={settings.language}
          onChange={(v) => setSettings({ ...settings, language: v })}
          options={[
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
            { value: 'pt', label: 'Português' },
          ]}
        />
      </FormSection>

      <FormSection title="Mensajes" description="Configura los mensajes automáticos" icon={<MessageSquare className="w-5 h-5" />}>
        <TextareaField
          label="Mensaje de Bienvenida"
          value={settings.welcomeMessage}
          onChange={(v) => setSettings({ ...settings, welcomeMessage: v })}
          placeholder="¡Hola! ¿En qué puedo ayudarte?"
        />
        <TextareaField
          label="Mensaje Fuera de Línea"
          value={settings.offlineMessage}
          onChange={(v) => setSettings({ ...settings, offlineMessage: v })}
          placeholder="No hay agentes disponibles..."
        />
      </FormSection>

      <FormSection title="Comportamiento" description="Ajusta cómo responde el bot" icon={<Zap className="w-5 h-5" />}>
        <ToggleField
          label="Respuestas Automáticas"
          description="Habilitar respuestas automáticas del bot"
          checked={settings.autoReplyEnabled}
          onChange={(v) => setSettings({ ...settings, autoReplyEnabled: v })}
        />
        {settings.autoReplyEnabled && (
          <InputField
            label="Retraso de Respuesta"
            value={settings.autoReplyDelay}
            onChange={(v) => setSettings({ ...settings, autoReplyDelay: parseInt(v) || 0 })}
            type="number"
            suffix="ms"
            min={0}
            max={5000}
          />
        )}
        <ToggleField
          label="Indicador de Escritura"
          description="Mostrar cuando el bot está escribiendo"
          checked={settings.typingIndicator}
          onChange={(v) => setSettings({ ...settings, typingIndicator: v })}
        />
      </FormSection>
    </div>
  );
}

function ChatSettingsForm({
  settings,
  setSettings,
}: {
  settings: ChatSettings;
  setSettings: (settings: ChatSettings) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection title="Cola de Espera" description="Configura la gestión de la cola" icon={<Clock className="w-5 h-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Tamaño Máximo de Cola"
            value={settings.maxQueueSize}
            onChange={(v) => setSettings({ ...settings, maxQueueSize: parseInt(v) || 50 })}
            type="number"
            suffix="chats"
          />
          <InputField
            label="Tiempo de Espera Máximo"
            value={settings.queueTimeout}
            onChange={(v) => setSettings({ ...settings, queueTimeout: parseInt(v) || 300 })}
            type="number"
            suffix="seg"
          />
        </div>
        <InputField
          label="Timeout de Inactividad"
          value={settings.inactivityTimeout}
          onChange={(v) => setSettings({ ...settings, inactivityTimeout: parseInt(v) || 600 })}
          type="number"
          suffix="seg"
        />
      </FormSection>

      <FormSection title="Archivos" description="Configura el intercambio de archivos" icon={<FileText className="w-5 h-5" />}>
        <ToggleField
          label="Permitir Archivos"
          description="Permitir que usuarios envíen archivos"
          checked={settings.enableFileSharing}
          onChange={(v) => setSettings({ ...settings, enableFileSharing: v })}
        />
        {settings.enableFileSharing && (
          <>
            <InputField
              label="Tamaño Máximo de Archivo"
              value={settings.maxFileSize}
              onChange={(v) => setSettings({ ...settings, maxFileSize: parseInt(v) || 10 })}
              type="number"
              suffix="MB"
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipos de Archivo Permitidos</label>
              <input
                type="text"
                value={settings.allowedFileTypes.join(', ')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allowedFileTypes: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
                placeholder="pdf, png, jpg..."
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">Separados por comas</p>
            </div>
          </>
        )}
      </FormSection>

      <FormSection title="Funciones" description="Habilita funciones adicionales" icon={<Sparkles className="w-5 h-5" />}>
        <ToggleField
          label="Emojis"
          description="Permitir emojis en los mensajes"
          checked={settings.enableEmoji}
          onChange={(v) => setSettings({ ...settings, enableEmoji: v })}
        />
        <ToggleField
          label="Sugerencias"
          description="Mostrar sugerencias de respuesta"
          checked={settings.enableSuggestions}
          onChange={(v) => setSettings({ ...settings, enableSuggestions: v })}
        />
      </FormSection>
    </div>
  );
}

function AgentSettingsForm({
  settings,
  setSettings,
}: {
  settings: AgentSettings;
  setSettings: (settings: AgentSettings) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection title="Asignación de Chats" description="Configura cómo se asignan los chats" icon={<UserCog className="w-5 h-5" />}>
        <InputField
          label="Chats Simultáneos por Defecto"
          value={settings.defaultMaxChats}
          onChange={(v) => setSettings({ ...settings, defaultMaxChats: parseInt(v) || 5 })}
          type="number"
          min={1}
          max={20}
        />
        <ToggleField
          label="Asignación Automática"
          description="Asignar chats automáticamente a agentes disponibles"
          checked={settings.autoAssign}
          onChange={(v) => setSettings({ ...settings, autoAssign: v })}
        />
        {settings.autoAssign && (
          <>
            <ToggleField
              label="Round Robin"
              description="Distribuir chats equitativamente entre agentes"
              checked={settings.roundRobinEnabled}
              onChange={(v) => setSettings({ ...settings, roundRobinEnabled: v })}
            />
            <ToggleField
              label="Enrutamiento por Habilidades"
              description="Asignar según las habilidades del agente"
              checked={settings.skillBasedRouting}
              onChange={(v) => setSettings({ ...settings, skillBasedRouting: v })}
            />
            <ToggleField
              label="Enrutamiento por Prioridad"
              description="Priorizar clientes VIP o casos urgentes"
              checked={settings.priorityRouting}
              onChange={(v) => setSettings({ ...settings, priorityRouting: v })}
            />
          </>
        )}
      </FormSection>

      <FormSection title="Horario de Trabajo" description="Define el horario de atención" icon={<Clock className="w-5 h-5" />}>
        <ToggleField
          label="Habilitar Horario"
          description="Restringir atención a horario laboral"
          checked={settings.workingHoursEnabled}
          onChange={(v) => setSettings({ ...settings, workingHoursEnabled: v })}
        />
        {settings.workingHoursEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Hora de Inicio"
              value={settings.workingHoursStart}
              onChange={(v) => setSettings({ ...settings, workingHoursStart: v })}
              type="time"
            />
            <InputField
              label="Hora de Fin"
              value={settings.workingHoursEnd}
              onChange={(v) => setSettings({ ...settings, workingHoursEnd: v })}
              type="time"
            />
          </div>
        )}
      </FormSection>
    </div>
  );
}

function SecuritySettingsForm({
  settings,
  setSettings,
}: {
  settings: SecuritySettings;
  setSettings: (settings: SecuritySettings) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection title="Sesiones" description="Configura la seguridad de sesiones" icon={<Lock className="w-5 h-5" />}>
        <InputField
          label="Timeout de Sesión"
          value={settings.sessionTimeout}
          onChange={(v) => setSettings({ ...settings, sessionTimeout: parseInt(v) || 480 })}
          type="number"
          suffix="min"
        />
        <InputField
          label="Intentos de Login Máximos"
          value={settings.maxLoginAttempts}
          onChange={(v) => setSettings({ ...settings, maxLoginAttempts: parseInt(v) || 5 })}
          type="number"
          min={1}
          max={10}
        />
        <ToggleField
          label="Autenticación de Dos Factores"
          description="Requerir 2FA para todos los usuarios"
          checked={settings.twoFactorEnabled}
          onChange={(v) => setSettings({ ...settings, twoFactorEnabled: v })}
        />
      </FormSection>

      <FormSection title="Políticas de Contraseña" description="Define requisitos de contraseña" icon={<Key className="w-5 h-5" />}>
        <InputField
          label="Longitud Mínima"
          value={settings.passwordPolicy.minLength}
          onChange={(v) =>
            setSettings({
              ...settings,
              passwordPolicy: { ...settings.passwordPolicy, minLength: parseInt(v) || 8 },
            })
          }
          type="number"
          suffix="caracteres"
          min={6}
          max={32}
        />
        <ToggleField
          label="Requiere Mayúsculas"
          checked={settings.passwordPolicy.requireUppercase}
          onChange={(v) =>
            setSettings({
              ...settings,
              passwordPolicy: { ...settings.passwordPolicy, requireUppercase: v },
            })
          }
        />
        <ToggleField
          label="Requiere Números"
          checked={settings.passwordPolicy.requireNumbers}
          onChange={(v) =>
            setSettings({
              ...settings,
              passwordPolicy: { ...settings.passwordPolicy, requireNumbers: v },
            })
          }
        />
        <ToggleField
          label="Requiere Caracteres Especiales"
          checked={settings.passwordPolicy.requireSpecial}
          onChange={(v) =>
            setSettings({
              ...settings,
              passwordPolicy: { ...settings.passwordPolicy, requireSpecial: v },
            })
          }
        />
      </FormSection>

      <FormSection title="Auditoría" description="Configura los registros de auditoría" icon={<FileText className="w-5 h-5" />}>
        <InputField
          label="Retención de Logs"
          value={settings.auditLogRetention}
          onChange={(v) => setSettings({ ...settings, auditLogRetention: parseInt(v) || 90 })}
          type="number"
          suffix="días"
        />
      </FormSection>
    </div>
  );
}

function NotificationSettingsForm({
  settings,
  setSettings,
}: {
  settings: NotificationSettings;
  setSettings: (settings: NotificationSettings) => void;
}) {
  return (
    <div className="space-y-6">
      <FormSection title="Notificaciones por Email" description="Configura alertas por correo" icon={<Mail className="w-5 h-5" />}>
        <ToggleField
          label="Notificaciones por Email"
          description="Recibir alertas importantes por email"
          checked={settings.emailNotifications}
          onChange={(v) => setSettings({ ...settings, emailNotifications: v })}
        />
        <ToggleField
          label="Alertas de Escalación"
          description="Notificar cuando un chat es escalado"
          checked={settings.escalationAlerts}
          onChange={(v) => setSettings({ ...settings, escalationAlerts: v })}
        />
        <ToggleField
          label="Reporte Diario"
          description="Recibir resumen diario de actividad"
          checked={settings.dailyReportEmail}
          onChange={(v) => setSettings({ ...settings, dailyReportEmail: v })}
        />
      </FormSection>

      <FormSection title="Sonidos y Alertas" description="Configura notificaciones en el navegador" icon={<Volume2 className="w-5 h-5" />}>
        <ToggleField
          label="Notificaciones de Escritorio"
          description="Mostrar notificaciones del navegador"
          checked={settings.desktopNotifications}
          onChange={(v) => setSettings({ ...settings, desktopNotifications: v })}
        />
        <ToggleField
          label="Sonido de Nuevo Chat"
          description="Reproducir sonido al recibir un chat"
          checked={settings.newChatSound}
          onChange={(v) => setSettings({ ...settings, newChatSound: v })}
        />
        <ToggleField
          label="Sonido de Nuevo Mensaje"
          description="Reproducir sonido al recibir un mensaje"
          checked={settings.newMessageSound}
          onChange={(v) => setSettings({ ...settings, newMessageSound: v })}
        />
      </FormSection>
    </div>
  );
}
