// MySettingsPage - User settings with tabs for Account, Preferences, Notifications, Security, Activity
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  User,
  Sliders,
  Bell,
  Shield,
  History,
  Save,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Camera,
  Upload
} from 'lucide-react';
import type { AgentPreferences, AgentSession, AgentActivity } from '../types';
import * as settingsService from '../services/settings.service';

type TabType = 'account' | 'preferences' | 'notifications' | 'security' | 'activity';

const tabs = [
  { id: 'account' as TabType, label: 'Account', icon: User },
  { id: 'preferences' as TabType, label: 'Preferences', icon: Sliders },
  { id: 'notifications' as TabType, label: 'Notifications', icon: Bell },
  { id: 'security' as TabType, label: 'Security', icon: Shield },
  { id: 'activity' as TabType, label: 'Activity', icon: History },
];

export default function MySettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const agent = useAuthStore((s) => s.agent);
  const updateAgentFields = useAuthStore((s) => s.updateAgentFields);

  const currentTab = (tab as TabType) || 'account';

  useEffect(() => {
    if (!tab) {
      navigate('/dashboard/my-settings/account', { replace: true });
    }
  }, [tab, navigate]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white">My Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-56 border-r border-gray-800 p-4 space-y-1">
          {tabs.map((t) => (
            <Link
              key={t.id}
              to={`/dashboard/my-settings/${t.id}`}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                currentTab === t.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <t.icon className="w-5 h-5" />
              <span className="font-medium">{t.label}</span>
            </Link>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentTab === 'account' && <AccountTab agent={agent} updateAgentFields={updateAgentFields} />}
          {currentTab === 'preferences' && <PreferencesTab />}
          {currentTab === 'notifications' && <NotificationsTab />}
          {currentTab === 'security' && <SecurityTab />}
          {currentTab === 'activity' && <ActivityTab />}
        </div>
      </div>
    </div>
  );
}

// ============= ACCOUNT TAB =============

function AccountTab({ agent, updateAgentFields }: { agent: any; updateAgentFields: (fields: any) => void }) {
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    email: agent?.email || '',
    department: agent?.department || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    avatar: agent?.avatar || ''
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);
    setError('');

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const token = localStorage.getItem('trelk-support-auth') || '{}';
      let authToken = '';
      if (token) {
        try {
          const parsed = JSON.parse(token);
          authToken = parsed.state?.token || '';
        } catch {}
      }

      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        credentials: 'include',
        body: formDataUpload
      });

      const data = await res.json();
      if (data.ok && data.url) {
        setFormData({ ...formData, avatar: data.url });
        // Also update in backend immediately
        await settingsService.updateAccount({ avatar: data.url });
        updateAgentFields({ avatar: data.url });
      } else {
        setError(data.error || 'Failed to upload image');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload');
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || '',
        email: agent.email || '',
        department: agent.department || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        avatar: agent.avatar || ''
      });
    }
  }, [agent]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const updated = await settingsService.updateAccount(formData);
      updateAgentFields({ name: updated.name, email: updated.email, department: updated.department });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Profile Information</h2>
        
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {formData.avatar ? (
              <img
                src={formData.avatar}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-700"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center text-3xl text-white font-bold">
                {formData.name.charAt(0).toUpperCase()}
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-400">Profile photo</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="mt-1 text-sm text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              <Camera className="w-3 h-3" />
              Change photo
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="e.g., Customer Support"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Caracas">Venezuela (VET)</option>
              <option value="America/Bogota">Colombia (COT)</option>
              <option value="America/Mexico_City">Mexico City (CST)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Madrid">Madrid (CET)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Role Info */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Role & Permissions</h2>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium capitalize">
            {agent?.role || 'Agent'}
          </span>
          <span className="text-gray-400 text-sm">
            {agent?.role === 'admin' && 'Full access to all features'}
            {agent?.role === 'supervisor' && 'Can supervise agents and view reports'}
            {agent?.role === 'support' && 'Standard support agent'}
            {agent?.role === 'junior' && 'Limited access'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============= PREFERENCES TAB =============

import { useTheme, type Theme } from '../hooks/useTheme';

function PreferencesTab() {
  const { theme: currentTheme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Partial<AgentPreferences>>({
    theme: 'dark',
    focusMode: false,
    language: 'en',
    sounds: { enabled: true, newChat: true, newMessage: true, mention: true, volume: 70 },
    autoScroll: true,
    enterToSend: true,
    showTypingIndicator: true,
    shortcutsEnabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsService.getPreferences()
      .then((data) => {
        setPrefs(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleThemeChange = (theme: Theme) => {
    setPrefs({ ...prefs, theme });
    setTheme(theme); // Apply immediately
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updatePreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Appearance */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Appearance</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
            <div className="flex gap-3">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(theme)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                    currentTheme === theme
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {theme === 'light' && <Sun className="w-4 h-4" />}
                  {theme === 'dark' && <Moon className="w-4 h-4" />}
                  {theme === 'system' && <Monitor className="w-4 h-4" />}
                  <span className="capitalize">{theme}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-white font-medium">Focus Mode</p>
              <p className="text-sm text-gray-400">Hide distractions while chatting</p>
            </div>
            <ToggleSwitch
              checked={prefs.focusMode || false}
              onChange={(v) => setPrefs({ ...prefs, focusMode: v })}
            />
          </div>
        </div>
      </div>

      {/* Sounds */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          {prefs.sounds?.enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          Sounds
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <p className="text-white">Enable Sounds</p>
            <ToggleSwitch
              checked={prefs.sounds?.enabled || false}
              onChange={(v) => setPrefs({ ...prefs, sounds: { ...prefs.sounds!, enabled: v } })}
            />
          </div>
          {prefs.sounds?.enabled && (
            <>
              <div className="flex items-center justify-between py-2">
                <p className="text-gray-300">New chat sound</p>
                <ToggleSwitch
                  checked={prefs.sounds?.newChat || false}
                  onChange={(v) => setPrefs({ ...prefs, sounds: { ...prefs.sounds!, newChat: v } })}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <p className="text-gray-300">New message sound</p>
                <ToggleSwitch
                  checked={prefs.sounds?.newMessage || false}
                  onChange={(v) => setPrefs({ ...prefs, sounds: { ...prefs.sounds!, newMessage: v } })}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <p className="text-gray-300">Mention sound</p>
                <ToggleSwitch
                  checked={prefs.sounds?.mention || false}
                  onChange={(v) => setPrefs({ ...prefs, sounds: { ...prefs.sounds!, mention: v } })}
                />
              </div>
              <div className="py-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-300">Volume</p>
                  <span className="text-sm text-gray-400">{prefs.sounds?.volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={prefs.sounds?.volume || 70}
                  onChange={(e) => setPrefs({ ...prefs, sounds: { ...prefs.sounds!, volume: parseInt(e.target.value) } })}
                  className="w-full accent-primary"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat Behavior */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Chat Behavior</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white">Auto-scroll to new messages</p>
              <p className="text-sm text-gray-400">Automatically scroll when new messages arrive</p>
            </div>
            <ToggleSwitch
              checked={prefs.autoScroll || false}
              onChange={(v) => setPrefs({ ...prefs, autoScroll: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white">Enter to send</p>
              <p className="text-sm text-gray-400">Press Enter to send messages (Shift+Enter for new line)</p>
            </div>
            <ToggleSwitch
              checked={prefs.enterToSend || false}
              onChange={(v) => setPrefs({ ...prefs, enterToSend: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white">Show typing indicator</p>
              <p className="text-sm text-gray-400">Let users know when you're typing</p>
            </div>
            <ToggleSwitch
              checked={prefs.showTypingIndicator || false}
              onChange={(v) => setPrefs({ ...prefs, showTypingIndicator: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white">Keyboard shortcuts</p>
              <p className="text-sm text-gray-400">Enable keyboard shortcuts for quick actions</p>
            </div>
            <ToggleSwitch
              checked={prefs.shortcutsEnabled || false}
              onChange={(v) => setPrefs({ ...prefs, shortcutsEnabled: v })}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

// ============= NOTIFICATIONS TAB =============

const defaultNotifications: settingsService.NotificationSettings = {
  email: { enabled: true, onNewChat: true, onMention: true, onAssignment: true, dailyDigest: false },
  inApp: { enabled: true, sound: true, onNewMessage: true, onNewChat: true, onMention: true },
  telegram: { enabled: false, onNewChat: false, onMention: false },
  desktop: { enabled: true, onNewMessage: true, onNewChat: true }
};

function NotificationsTab() {
  const [notifs, setNotifs] = useState<settingsService.NotificationSettings>(defaultNotifications);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsService.getNotifications()
      .then((data) => {
        // Merge with defaults to ensure all properties exist
        setNotifs({
          email: { ...defaultNotifications.email, ...data?.email },
          inApp: { ...defaultNotifications.inApp, ...data?.inApp },
          telegram: { ...defaultNotifications.telegram, ...data?.telegram },
          desktop: { ...defaultNotifications.desktop, ...data?.desktop }
        });
      })
      .catch(() => {
        // Use defaults
        setNotifs(defaultNotifications);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!notifs) return;
    setSaving(true);
    try {
      await settingsService.updateNotifications(notifs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Email Notifications */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Email Notifications</h2>
          <ToggleSwitch
            checked={notifs.email.enabled}
            onChange={(v) => setNotifs({ ...notifs, email: { ...notifs.email, enabled: v } })}
          />
        </div>
        {notifs.email.enabled && (
          <div className="space-y-3 pl-4 border-l-2 border-gray-700">
            <div className="flex items-center justify-between py-2">
              <p className="text-gray-300">New chat assigned</p>
              <ToggleSwitch
                checked={notifs.email.onAssignment}
                onChange={(v) => setNotifs({ ...notifs, email: { ...notifs.email, onAssignment: v } })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-gray-300">When mentioned</p>
              <ToggleSwitch
                checked={notifs.email.onMention}
                onChange={(v) => setNotifs({ ...notifs, email: { ...notifs.email, onMention: v } })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-gray-300">Daily digest</p>
              <ToggleSwitch
                checked={notifs.email.dailyDigest}
                onChange={(v) => setNotifs({ ...notifs, email: { ...notifs.email, dailyDigest: v } })}
              />
            </div>
          </div>
        )}
      </div>

      {/* In-App Notifications */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">In-App Notifications</h2>
          <ToggleSwitch
            checked={notifs.inApp.enabled}
            onChange={(v) => setNotifs({ ...notifs, inApp: { ...notifs.inApp, enabled: v } })}
          />
        </div>
        {notifs.inApp.enabled && (
          <div className="space-y-3 pl-4 border-l-2 border-gray-700">
            <div className="flex items-center justify-between py-2">
              <p className="text-gray-300">New message</p>
              <ToggleSwitch
                checked={notifs.inApp.onNewMessage}
                onChange={(v) => setNotifs({ ...notifs, inApp: { ...notifs.inApp, onNewMessage: v } })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-gray-300">New chat</p>
              <ToggleSwitch
                checked={notifs.inApp.onNewChat}
                onChange={(v) => setNotifs({ ...notifs, inApp: { ...notifs.inApp, onNewChat: v } })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-gray-300">Play sound</p>
              <ToggleSwitch
                checked={notifs.inApp.sound}
                onChange={(v) => setNotifs({ ...notifs, inApp: { ...notifs.inApp, sound: v } })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Desktop Notifications */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Desktop Notifications</h2>
          <ToggleSwitch
            checked={notifs.desktop.enabled}
            onChange={(v) => setNotifs({ ...notifs, desktop: { ...notifs.desktop, enabled: v } })}
          />
        </div>
        {notifs.desktop.enabled && (
          <div className="space-y-3 pl-4 border-l-2 border-gray-700">
            <div className="flex items-center justify-between py-2">
              <p className="text-gray-300">New message</p>
              <ToggleSwitch
                checked={notifs.desktop.onNewMessage}
                onChange={(v) => setNotifs({ ...notifs, desktop: { ...notifs.desktop, onNewMessage: v } })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-gray-300">New chat</p>
              <ToggleSwitch
                checked={notifs.desktop.onNewChat}
                onChange={(v) => setNotifs({ ...notifs, desktop: { ...notifs.desktop, onNewChat: v } })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Notifications'}
        </button>
      </div>
    </div>
  );
}

// ============= SECURITY TAB =============

function SecurityTab() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getSessions();
      setSessions(data.sessions);
      setCurrentSessionId(data.currentSessionId);
    } catch {}
    setLoading(false);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);
    
    if (passwordData.new !== passwordData.confirm) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (passwordData.new.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await settingsService.changePassword(passwordData.current, passwordData.new);
      setPasswordSuccess(true);
      setPasswordData({ current: '', new: '', confirm: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    }
    setChangingPassword(false);
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await settingsService.revokeSession(sessionId);
      setSessions(sessions.filter((s) => s._id !== sessionId));
    } catch {}
  };

  const handleRevokeAll = async () => {
    try {
      const result = await settingsService.revokeAllOtherSessions();
      loadSessions();
      alert(`Revoked ${result.revokedCount} sessions`);
    } catch {}
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Monitor;
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Change Password */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Change Password</h2>
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={passwordData.current}
              onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={passwordData.new}
              onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={passwordData.confirm}
              onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showPasswords"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="rounded border-gray-700 bg-gray-800"
            />
            <label htmlFor="showPasswords" className="text-sm text-gray-400">Show passwords</label>
          </div>

          {passwordError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-lg text-secondary text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              Password changed successfully!
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={changingPassword || !passwordData.current || !passwordData.new || !passwordData.confirm}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Change Password
          </button>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Active Sessions</h2>
          <div className="flex gap-2">
            <button
              onClick={loadSessions}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {sessions.length > 1 && (
              <button
                onClick={handleRevokeAll}
                className="text-sm text-danger hover:underline"
              >
                Sign out all other sessions
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.deviceType);
              const isCurrent = session._id === currentSessionId || session.isCurrent;
              
              return (
                <div
                  key={session._id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    isCurrent ? 'border-primary/30 bg-primary/5' : 'border-gray-700 bg-gray-800/50'
                  }`}
                >
                  <div className="p-2 bg-gray-700 rounded-lg">
                    <DeviceIcon className="w-5 h-5 text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{session.browser || 'Unknown browser'}</p>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {session.os || 'Unknown OS'} • {session.location || session.ip || 'Unknown location'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Last seen: {new Date(session.lastSeenAt).toLocaleString()}
                    </p>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(session._id)}
                      className="p-2 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                      title="Sign out this session"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {sessions.length === 0 && (
              <p className="text-center text-gray-500 py-8">No active sessions found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============= ACTIVITY TAB =============

function ActivityTab() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadActivity();
  }, [page]);

  const loadActivity = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getActivity(page, 20);
      setActivities(data.activities);
      setTotalPages(data.pages);
    } catch {}
    setLoading(false);
  };

  const getActivityIcon = (type: AgentActivity['type']) => {
    switch (type) {
      case 'login': return { icon: User, color: 'text-secondary' };
      case 'logout': return { icon: LogOut, color: 'text-gray-400' };
      case 'status_change': return { icon: RefreshCw, color: 'text-primary' };
      case 'chat_opened': return { icon: Eye, color: 'text-blue-400' };
      case 'chat_closed': return { icon: X, color: 'text-orange-400' };
      case 'password_changed': return { icon: Shield, color: 'text-warning' };
      case 'session_revoked': return { icon: AlertTriangle, color: 'text-danger' };
      default: return { icon: History, color: 'text-gray-400' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <button
            onClick={loadActivity}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-gray-800">
          {activities.map((activity) => {
            const { icon: Icon, color } = getActivityIcon(activity.type);
            return (
              <div key={activity._id} className="flex items-start gap-4 p-4">
                <div className={`p-2 bg-gray-800 rounded-lg ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-white">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{new Date(activity.createdAt).toLocaleString()}</span>
                    {activity.ip && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {activity.ip}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {activities.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No activity found
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-gray-400 px-4">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= TOGGLE SWITCH COMPONENT =============

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
