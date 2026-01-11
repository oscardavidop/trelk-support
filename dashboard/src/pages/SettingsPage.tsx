// Settings Page
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { 
  Settings as SettingsIcon,
  Bot,
  MessageSquare,
  Users,
  Shield,
  Save,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { Button, Input, Select, Toggle, toast } from '../components/ui';
import type { Settings, BotSettings, ChatSettings, AgentRules, SecuritySettings } from '../types';

type SettingsTab = 'bot' | 'chat' | 'agents' | 'security';

const tabs: { id: SettingsTab; label: string; icon: typeof Bot }[] = [
  { id: 'bot', label: 'Bot Settings', icon: Bot },
  { id: 'chat', label: 'Chat & Flow', icon: MessageSquare },
  { id: 'agents', label: 'Agent Rules', icon: Users },
  { id: 'security', label: 'Security', icon: Shield },
];

export default function SettingsPage() {
  const token = useAuthStore((state) => state.token);
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('bot');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form states
  const [botForm, setBotForm] = useState<BotSettings>({
    name: '',
    username: '',
    welcomeMessage: '',
    transferMessage: '',
    offlineMessage: '',
    defaultLanguage: 'en',
  });

  const [chatForm, setChatForm] = useState<ChatSettings>({
    maxWaitTimeMinutes: 5,
    autoCloseInactiveMinutes: 30,
    autoResponseEnabled: true,
    defaultBotMessage: '',
  });

  const [agentForm, setAgentForm] = useState<AgentRules>({
    maxConcurrentChats: 5,
    autoAssignEnabled: false,
    assignmentMode: 'manual',
  });

  const [securityForm, setSecurityForm] = useState<SecuritySettings>({
    jwtExpirationDays: 7,
    rateLimitPerMinute: 60,
    logCriticalEvents: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (data.ok) {
        setSettings(data.settings);
        setBotForm(data.settings.bot);
        setChatForm(data.settings.chat);
        setAgentForm(data.settings.agentRules);
        setSecurityForm(data.settings.security);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bot: botForm,
          chat: chatForm,
          agentRules: agentForm,
          security: securityForm,
        }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setSettings(data.settings);
        setHasChanges(false);
        toast.success('Settings saved successfully');
      } else {
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return;
    
    setSaving(true);
    
    try {
      const res = await fetch('/api/admin/settings/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setSettings(data.settings);
        setBotForm(data.settings.bot);
        setChatForm(data.settings.chat);
        setAgentForm(data.settings.agentRules);
        setSecurityForm(data.settings.security);
        setHasChanges(false);
        toast.success('Settings reset to defaults');
      } else {
        toast.error(data.error || 'Failed to reset settings');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const updateBotForm = (updates: Partial<BotSettings>) => {
    setBotForm({ ...botForm, ...updates });
    setHasChanges(true);
  };

  const updateChatForm = (updates: Partial<ChatSettings>) => {
    setChatForm({ ...chatForm, ...updates });
    setHasChanges(true);
  };

  const updateAgentForm = (updates: Partial<AgentRules>) => {
    setAgentForm({ ...agentForm, ...updates });
    setHasChanges(true);
  };

  const updateSecurityForm = (updates: Partial<SecuritySettings>) => {
    setSecurityForm({ ...securityForm, ...updates });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-primary" />
            Settings
          </h1>
          <p className="text-gray-500 mt-1">Configure your support platform</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleReset} icon={<RotateCcw className="w-4 h-4" />}>
            Reset
          </Button>
          <Button 
            onClick={handleSave} 
            loading={saving}
            disabled={!hasChanges}
            icon={<Save className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors
                    ${activeTab === tab.id 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
          
          {/* Last Updated */}
          {settings && (
            <div className="mt-6 px-4 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-500">Last updated</p>
              <p className="text-sm text-gray-400 mt-1">
                {new Date(settings.updatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          {activeTab === 'bot' && (
            <BotSettingsForm form={botForm} onChange={updateBotForm} />
          )}
          {activeTab === 'chat' && (
            <ChatSettingsForm form={chatForm} onChange={updateChatForm} />
          )}
          {activeTab === 'agents' && (
            <AgentRulesForm form={agentForm} onChange={updateAgentForm} />
          )}
          {activeTab === 'security' && (
            <SecuritySettingsForm form={securityForm} onChange={updateSecurityForm} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============= FORM COMPONENTS =============

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// Bot Settings Form
function BotSettingsForm({ 
  form, 
  onChange 
}: { 
  form: BotSettings; 
  onChange: (updates: Partial<BotSettings>) => void;
}) {
  return (
    <div className="space-y-8">
      <FormSection title="Bot Identity" description="Basic information about your bot">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bot Name"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Trelk Support"
          />
          <Input
            label="Bot Username"
            value={form.username}
            onChange={(e) => onChange({ username: e.target.value })}
            placeholder="TrelkSupportBot"
            helperText="Without the @ symbol"
          />
        </div>
        <Select
          label="Default Language"
          value={form.defaultLanguage}
          onChange={(value) => onChange({ defaultLanguage: value as 'en' | 'es' })}
          options={[
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
          ]}
        />
      </FormSection>

      <FormSection title="Bot Messages" description="Customize automatic messages sent by the bot">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Welcome Message</label>
            <textarea
              value={form.welcomeMessage}
              onChange={(e) => onChange({ welcomeMessage: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              placeholder="Welcome message when user starts the bot..."
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Transfer to Human Message</label>
            <textarea
              value={form.transferMessage}
              onChange={(e) => onChange({ transferMessage: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              placeholder="Message when transferring to human agent..."
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Offline Message</label>
            <textarea
              value={form.offlineMessage}
              onChange={(e) => onChange({ offlineMessage: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              placeholder="Message when no agents are available..."
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}

// Chat Settings Form
function ChatSettingsForm({ 
  form, 
  onChange 
}: { 
  form: ChatSettings; 
  onChange: (updates: Partial<ChatSettings>) => void;
}) {
  return (
    <div className="space-y-8">
      <FormSection title="Timing Settings" description="Configure wait times and auto-close behavior">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Max Wait Time (minutes)"
            type="number"
            min={1}
            max={60}
            value={form.maxWaitTimeMinutes}
            onChange={(e) => onChange({ maxWaitTimeMinutes: parseInt(e.target.value) || 5 })}
            helperText="Time before suggesting alternative options"
          />
          <Input
            label="Auto-Close Inactive (minutes)"
            type="number"
            min={5}
            max={120}
            value={form.autoCloseInactiveMinutes}
            onChange={(e) => onChange({ autoCloseInactiveMinutes: parseInt(e.target.value) || 30 })}
            helperText="Close chats after this inactivity period"
          />
        </div>
      </FormSection>

      <FormSection title="Auto Response" description="Configure automatic bot responses">
        <Toggle
          enabled={form.autoResponseEnabled}
          onChange={(enabled) => onChange({ autoResponseEnabled: enabled })}
          label="Enable Auto-Response"
          description="Bot will automatically respond to common questions"
        />
        
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">Default Bot Message</label>
          <textarea
            value={form.defaultBotMessage}
            onChange={(e) => onChange({ defaultBotMessage: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            placeholder="Default message when bot can't understand..."
          />
        </div>
      </FormSection>
    </div>
  );
}

// Agent Rules Form
function AgentRulesForm({ 
  form, 
  onChange 
}: { 
  form: AgentRules; 
  onChange: (updates: Partial<AgentRules>) => void;
}) {
  return (
    <div className="space-y-8">
      <FormSection title="Workload Settings" description="Configure agent workload limits">
        <Input
          label="Max Concurrent Chats per Agent"
          type="number"
          min={1}
          max={20}
          value={form.maxConcurrentChats}
          onChange={(e) => onChange({ maxConcurrentChats: parseInt(e.target.value) || 5 })}
          helperText="Maximum number of simultaneous chats an agent can handle"
        />
      </FormSection>

      <FormSection title="Assignment Settings" description="Configure how chats are assigned to agents">
        <Toggle
          enabled={form.autoAssignEnabled}
          onChange={(enabled) => onChange({ autoAssignEnabled: enabled })}
          label="Auto-Assign Chats"
          description="Automatically assign waiting chats to available agents"
        />
        
        <Select
          label="Assignment Mode"
          value={form.assignmentMode}
          onChange={(value) => onChange({ assignmentMode: value as AgentRules['assignmentMode'] })}
          options={[
            { value: 'manual', label: 'Manual (agents pick chats)' },
            { value: 'round-robin', label: 'Round Robin (rotate between agents)' },
            { value: 'least-busy', label: 'Least Busy (assign to agent with fewer chats)' },
          ]}
        />
      </FormSection>
    </div>
  );
}

// Security Settings Form
function SecuritySettingsForm({ 
  form, 
  onChange 
}: { 
  form: SecuritySettings; 
  onChange: (updates: Partial<SecuritySettings>) => void;
}) {
  const token = useAuthStore((state) => state.token);
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);

  const handleForceLogout = async () => {
    if (!confirm('This will set all agents to offline. Continue?')) return;
    
    setForceLogoutLoading(true);
    
    try {
      const res = await fetch('/api/admin/force-logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      
      if (data.ok) {
        toast.success('All agents set to offline');
      } else {
        toast.error(data.error || 'Failed to force logout');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setForceLogoutLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <FormSection title="Session Settings" description="Configure authentication and session behavior">
        <Input
          label="JWT Expiration (days)"
          type="number"
          min={1}
          max={30}
          value={form.jwtExpirationDays}
          onChange={(e) => onChange({ jwtExpirationDays: parseInt(e.target.value) || 7 })}
          helperText="How long agents stay logged in"
        />
      </FormSection>

      <FormSection title="Rate Limiting" description="Protect against abuse">
        <Input
          label="Rate Limit per Minute"
          type="number"
          min={10}
          max={1000}
          value={form.rateLimitPerMinute}
          onChange={(e) => onChange({ rateLimitPerMinute: parseInt(e.target.value) || 60 })}
          helperText="Maximum API requests per minute per IP"
        />
      </FormSection>

      <FormSection title="Logging" description="Configure event logging">
        <Toggle
          enabled={form.logCriticalEvents}
          onChange={(enabled) => onChange({ logCriticalEvents: enabled })}
          label="Log Critical Events"
          description="Record login attempts, password changes, and admin actions"
        />
      </FormSection>

      <FormSection title="Emergency Actions" description="Use with caution">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-red-400">Force Logout All Agents</h4>
              <p className="text-sm text-gray-500 mt-1">Set all agents to offline status</p>
            </div>
            <Button 
              variant="danger" 
              size="sm"
              onClick={handleForceLogout}
              loading={forceLogoutLoading}
            >
              Force Logout
            </Button>
          </div>
        </div>
      </FormSection>
    </div>
  );
}
