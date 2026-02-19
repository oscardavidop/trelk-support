import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  User, Sliders, Bell, Shield, History, Save, Loader2, Monitor, Smartphone, Tablet, Globe, Trash2,
  AlertTriangle, Check, X, Volume2, VolumeX, Moon, Sun, Eye, EyeOff, LogOut, RefreshCw, Camera, Upload,
  ChevronRight, Mail, Hash, MapPin, Laptop, Layout, Keyboard, MessageSquare, Zap, ClipboardCheck, TrendingUp, TrendingDown, Minus, Star, AlertCircle, ExternalLink,
  Languages, Lock
} from 'lucide-react';
import type { AgentPreferences, AgentSession, AgentActivity } from '../types';
import * as settingsService from '../services/settings.service';
import * as qaService from '../services/qa.service';
import { getOutgoingConfig, getIncomingConfig } from '../services/translation.service';
import type { AgentQAPerformance, QAReview } from '../services/qa.service';
import { useTheme, type Theme } from '../hooks/useTheme';
import MFASettingsSection from '../components/MFASettingsSection';

type TabType = 'account' | 'preferences' | 'notifications' | 'security' | 'activity' | 'quality';

const TABS = [
  { id: 'account', label: 'Mi Cuenta', icon: User, desc: 'Perfil personal y avatar' },
  { id: 'preferences', label: 'Preferencias', icon: Sliders, desc: 'Interfaz, sonidos y chat' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, desc: 'Alertas y correos' },
  { id: 'security', label: 'Seguridad', icon: Shield, desc: 'Accesos y contraseñas' },
  { id: 'activity', label: 'Actividad', icon: History, desc: 'Registro de eventos' },
  { id: 'quality', label: 'Calidad QA', icon: ClipboardCheck, desc: 'Rendimiento y evaluaciones' },
] as const;

export default function MySettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const agent = useAuthStore((s) => s.agent);
  const updateAgentFields = useAuthStore((s) => s.updateAgentFields);

  const currentTab = (tab as TabType) || 'account';
  const activeTabInfo = TABS.find(t => t.id === currentTab);

  useEffect(() => {
    if (!tab) navigate('/dashboard/my-settings/account', { replace: true });
  }, [tab, navigate]);

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      {/* LEFT SIDEBAR */}
      <div className="w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 z-20 h-full">
        <div className="p-6 border-b border-zinc-800/50">
          <h1 className="text-xl font-bold text-zinc-50 tracking-tight">Configuración</h1>
          <p className="text-sm text-zinc-500 mt-1">Administra tu experiencia</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {TABS.map((t) => {
            const isActive = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/dashboard/my-settings/${t.id}`)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-left transition-all duration-200 group ${
                  isActive 
                    ? 'bg-zinc-800 border border-zinc-700 shadow-sm' 
                    : 'hover:bg-zinc-800/50 border border-transparent hover:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-900 text-zinc-500 group-hover:text-zinc-300'}`}>
                    <t.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className={`block text-sm font-medium ${isActive ? 'text-zinc-50' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                      {t.label}
                    </span>
                  </div>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-zinc-500" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-zinc-50 font-bold text-xs shadow-lg">
                    {agent?.name?.[0] || 'U'}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-zinc-50 truncate">{agent?.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{agent?.email}</p>
                </div>
            </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950 relative">
        
        {/* Header Sticky */}
        <div className="px-8 py-6 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-indigo-500/5">
              {activeTabInfo && <activeTabInfo.icon className="w-6 h-6 text-indigo-500" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-50 tracking-tight">{activeTabInfo?.label}</h2>
              <p className="text-sm text-zinc-400">{activeTabInfo?.desc}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="w-full max-w-5xl space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {currentTab === 'account' && <AccountContent agent={agent} updateAgentFields={updateAgentFields} />}
            {currentTab === 'preferences' && <PreferencesContent />}
            {currentTab === 'notifications' && <NotificationsContent />}
            {currentTab === 'security' && <SecurityContent />}
            {currentTab === 'activity' && <ActivityContent />}
            {currentTab === 'quality' && <QualityContent />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= 1. ACCOUNT CONTENT =============

function AccountContent({ agent, updateAgentFields }: { agent: any; updateAgentFields: (fields: any) => void }) {
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
    if (!file.type.startsWith('image/')) { setError('Solo imágenes'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Máximo 5MB'); return; }

    setUploadingAvatar(true); setError('');
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      // Mock logic for token retrieval
      const token = JSON.parse(localStorage.getItem('trelk-support-auth') || '{}')?.state?.token;
      
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataUpload
      });
      const data = await res.json();
      
      if (data.ok && data.url) {
        setFormData({ ...formData, avatar: data.url });
        await settingsService.updateAccount({ avatar: data.url });
        updateAgentFields({ avatar: data.url });
      } else throw new Error(data.error);
    } catch (err: any) { setError(err.message || 'Error al subir imagen'); } 
    finally { setUploadingAvatar(false); }
  };

  const handleSave = async () => {
    setLoading(true); setError('');
    try {
      const updated = await settingsService.updateAccount(formData);
      updateAgentFields({ name: updated.name, email: updated.email, department: updated.department });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err: any) { setError(err.message || 'Error al guardar'); } 
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <SectionCard title="Foto de Perfil" description="Esta imagen será visible para otros agentes y en los chats.">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-900 ring-4 ring-zinc-800 border border-zinc-700 flex items-center justify-center">
              {formData.avatar ? (
                <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-zinc-500">{formData.name.charAt(0).toUpperCase()}</span>
              )}
              {uploadingAvatar && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-50"/></div>}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 rounded-full shadow-lg border-2 border-zinc-900 transition-all hover:scale-110" disabled={uploadingAvatar}>
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <div>
            <div className="flex gap-3">
               <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-50 text-sm font-medium rounded-lg border border-zinc-700 transition-colors">
                 Subir nueva foto
               </button>
               {formData.avatar && (
                 <button onClick={() => setFormData({...formData, avatar: ''})} className="px-4 py-2 text-red-400 hover:bg-red-500/10 text-sm font-medium rounded-lg border border-transparent hover:border-red-500/20 transition-colors">
                   Eliminar
                 </button>
               )}
            </div>
            <p className="text-xs text-zinc-500 mt-2">JPG, GIF o PNG. Máximo 5MB.</p>
          </div>
        </div>
      </SectionCard>

      {/* Info Card */}
      <SectionCard title="Información Personal" description="Actualiza tus datos básicos de identificación.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputGroup label="Nombre Completo" icon={User} value={formData.name} onChange={(v) => setFormData({...formData, name: v})} className="col-span-2" />
          <InputGroup label="Correo Electrónico" icon={Mail} value={formData.email} onChange={(v) => setFormData({...formData, email: v})} type="email" />
          <InputGroup label="Departamento" icon={Hash} value={formData.department} onChange={(v) => setFormData({...formData, department: v})} placeholder="Ej: Soporte" />
          
          <div className="space-y-2 col-span-2">
            <label className="text-xs font-bold text-zinc-500 uppercaseflex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Zona Horaria</label>
            <select 
              value={formData.timezone} 
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm appearance-none"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="UTC">UTC</option>
              {/* Add more options as needed */}
            </select>
          </div>
        </div>

        {error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}

        <div className="mt-6 flex justify-end">
           <SaveButton onClick={handleSave} loading={loading} saved={saved} />
        </div>
      </SectionCard>
    </div>
  );
}

// ============= 2. PREFERENCES CONTENT =============

function PreferencesContent() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Partial<AgentPreferences>>({ 
    theme: 'dark', 
    focusMode: false, 
    sounds: { enabled: true, volume: 70, newChat: true, newMessage: true, mention: true },
    autoScroll: true,
    enterToSend: true,
    showTypingIndicator: true,
    shortcutsEnabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orgOverrideAllowed, setOrgOverrideAllowed] = useState(true);
  const [orgIncomingOverrideAllowed, setOrgIncomingOverrideAllowed] = useState(true);

  useEffect(() => {
    settingsService.getPreferences().then(setPrefs).catch(() => {}).finally(() => setLoading(false));
    getOutgoingConfig('').then(cfg => setOrgOverrideAllowed(cfg.agentOverrideAllowed)).catch(() => {});
    getIncomingConfig('').then(cfg => setOrgIncomingOverrideAllowed(cfg.agentOverrideAllowed)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try { await settingsService.updatePreferences(prefs); setSaved(true); setTimeout(() => setSaved(false), 2000); } catch {}
    setSaving(false);
  };

  if(loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin"/></div>;

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <SectionCard title="Apariencia" description="Personaliza el aspecto de la interfaz.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
           {[ {id: 'light', icon: Sun, label: 'Claro'}, {id: 'dark', icon: Moon, label: 'Oscuro'}, {id: 'system', icon: Monitor, label: 'Sistema'} ].map(opt => (
             <button 
               key={opt.id}
               onClick={() => { setTheme(opt.id as Theme); setPrefs({...prefs, theme: opt.id as Theme}); }}
               className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${theme === opt.id ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400 ring-1 ring-indigo-500/20' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
             >
                <opt.icon className="w-6 h-6" />
                <span className="text-sm font-medium">{opt.label}</span>
             </button>
           ))}
        </div>
        <ToggleRow 
            label="Modo Enfoque" 
            desc="Ocultar distracciones y paneles secundarios"
            checked={prefs.focusMode || false} 
            onChange={(v) => setPrefs({ ...prefs, focusMode: v })} 
            icon={EyeOff}
        />
      </SectionCard>

      {/* Sounds */}
      <SectionCard title="Sonidos y Alertas" description="Configura los efectos de audio.">
         <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400"><Volume2 className="w-5 h-5"/></div>
                    <div><p className="text-zinc-50 font-medium text-sm">Activar Sonidos</p><p className="text-xs text-zinc-500">Silenciar todas las alertas</p></div>
                </div>
                <ToggleSwitch checked={prefs.sounds?.enabled || false} onChange={v => setPrefs({...prefs, sounds: {...prefs.sounds!, enabled: v}})} />
            </div>
            
            {prefs.sounds?.enabled && (
               <div className="pl-4 ml-3 border-l-2 border-zinc-800 space-y-5 pt-2">
                  <div className="space-y-3 px-2">
                     <div className="flex justify-between text-xs font-bold text-zinc-500 "><span>Volumen Maestro</span><span>{prefs.sounds.volume}%</span></div>
                     <input type="range" min="0" max="100" value={prefs.sounds.volume} onChange={(e) => setPrefs({...prefs, sounds: {...prefs.sounds!, volume: parseInt(e.target.value)}})} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                  </div>
                  <div className="space-y-2">
                      <ToggleRow label="Sonido Nuevo Chat" checked={prefs.sounds.newChat!} onChange={v => setPrefs({...prefs, sounds: {...prefs.sounds!, newChat: v}})} small />
                      <ToggleRow label="Sonido Nuevo Mensaje" checked={prefs.sounds.newMessage!} onChange={v => setPrefs({...prefs, sounds: {...prefs.sounds!, newMessage: v}})} small />
                      <ToggleRow label="Sonido Menciones" checked={prefs.sounds.mention!} onChange={v => setPrefs({...prefs, sounds: {...prefs.sounds!, mention: v}})} small />
                  </div>
               </div>
            )}
         </div>
      </SectionCard>

      {/* Chat Behavior (Restored!) */}
      <SectionCard title="Comportamiento del Chat" description="Ajusta cómo funciona la mensajería.">
         <div className="space-y-3">
            <ToggleRow 
                label="Auto-scroll" 
                desc="Bajar automáticamente al recibir mensajes" 
                checked={prefs.autoScroll!} 
                onChange={v => setPrefs({...prefs, autoScroll: v})} 
                icon={Layout} 
            />
            <ToggleRow 
                label="Enter para enviar" 
                desc="Usa Shift+Enter para salto de línea" 
                checked={prefs.enterToSend!} 
                onChange={v => setPrefs({...prefs, enterToSend: v})} 
                icon={Keyboard} 
            />
            <ToggleRow 
                label="Indicador de escritura" 
                desc="Mostrar cuando estás escribiendo" 
                checked={prefs.showTypingIndicator!} 
                onChange={v => setPrefs({...prefs, showTypingIndicator: v})} 
                icon={MessageSquare} 
            />
            <ToggleRow 
                label="Atajos de teclado" 
                desc="Habilitar hotkeys para acciones rápidas" 
                checked={prefs.shortcutsEnabled!} 
                onChange={v => setPrefs({...prefs, shortcutsEnabled: v})} 
                icon={Zap} 
            />
         </div>
      </SectionCard>

      {/* Translation Preferences */}
      <SectionCard title="Traducción Automática" description="Configura cómo se traducen tus mensajes salientes.">
        {!orgOverrideAllowed && (
          <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center gap-3">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300/80">
              La configuración de traducción está administrada por tu organización. No puedes modificar estas opciones.
            </p>
          </div>
        )}
        <div className={`space-y-4 ${!orgOverrideAllowed ? 'opacity-50 pointer-events-none select-none' : ''}`}>
          <div>
            <label className="block text-xs text-zinc-500 mb-2 font-bold">Modo de traducción saliente</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'global' as const, label: 'Global', desc: 'Usar configuración del admin' },
                { id: 'always_on' as const, label: 'Siempre ON', desc: 'Traducir siempre mis mensajes' },
                { id: 'always_off' as const, label: 'Siempre OFF', desc: 'Nunca traducir mis mensajes' },
              ]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setPrefs({
                    ...prefs,
                    translation: { ...prefs.translation, outgoingOverride: opt.id } as any
                  })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    (prefs.translation as any)?.outgoingOverride === opt.id
                      ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400 ring-1 ring-indigo-500/20'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-bold">Idioma en que escribo</label>
            <select
              value={(prefs.translation as any)?.agentWritesIn || 'es'}
              onChange={e => setPrefs({
                ...prefs,
                translation: { ...prefs.translation, agentWritesIn: e.target.value } as any
              })}
              className="w-full max-w-xs bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
              <option value="ru">Русский</option>
              <option value="zh">中文</option>
              <option value="ar">العربية</option>
              <option value="ja">日本語</option>
            </select>
            <p className="text-[10px] text-zinc-600 mt-1">Se usa como idioma de origen para la traducción automática</p>
          </div>

          <ToggleRow
            label="Confirmar antes de enviar"
            desc="Mostrar preview de traducción y pedir confirmación"
            checked={(prefs.translation as any)?.confirmBeforeSend ?? true}
            onChange={v => setPrefs({
              ...prefs,
              translation: { ...prefs.translation, confirmBeforeSend: v } as any
            })}
            icon={Languages}
          />

          <ToggleRow
            label="Mostrar preview de traducción"
            desc="Ver cómo se verá el mensaje traducido antes de enviarlo"
            checked={(prefs.translation as any)?.showPreview ?? true}
            onChange={v => setPrefs({
              ...prefs,
              translation: { ...prefs.translation, showPreview: v } as any
            })}
            icon={Eye}
          />
        </div>
      </SectionCard>

      {/* Incoming Translation Preferences */}
      <SectionCard title="Traducción Entrante" description="Configura cómo se traducen los mensajes del usuario para ti.">
        {!orgIncomingOverrideAllowed && (
          <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center gap-3">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300/80">
              La configuración de traducción entrante está administrada por tu organización.
            </p>
          </div>
        )}
        <div className={`space-y-4 ${!orgIncomingOverrideAllowed ? 'opacity-50 pointer-events-none select-none' : ''}`}>
          <div>
            <label className="block text-xs text-zinc-500 mb-2 font-bold">Modo de traducción entrante</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'global' as const, label: 'Global', desc: 'Usar configuración del admin' },
                { id: 'always_on' as const, label: 'Siempre ON', desc: 'Traducir mensajes entrantes' },
                { id: 'always_off' as const, label: 'Siempre OFF', desc: 'Nunca traducir entrantes' },
              ]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setPrefs({
                    ...prefs,
                    translation: { ...prefs.translation, incomingOverride: opt.id } as any
                  })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    (prefs.translation as any)?.incomingOverride === opt.id
                      ? 'bg-cyan-600/10 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/20'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-bold">Mi idioma preferido (destino de traducción)</label>
            <select
              value={(prefs.translation as any)?.incomingTargetLang || ''}
              onChange={e => setPrefs({
                ...prefs,
                translation: { ...prefs.translation, incomingTargetLang: e.target.value } as any
              })}
              className="w-full max-w-xs bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Usar default del sistema</option>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
              <option value="ru">Русский</option>
              <option value="zh">中文</option>
              <option value="ar">العربية</option>
              <option value="ja">日本語</option>
            </select>
            <p className="text-[10px] text-zinc-600 mt-1">Los mensajes del usuario se traducirán a este idioma</p>
          </div>

          <ToggleRow
            label="Mostrar original con traducción"
            desc="Ver el mensaje original junto con la traducción"
            checked={(prefs.translation as any)?.showOriginalWithTranslation ?? true}
            onChange={v => setPrefs({
              ...prefs,
              translation: { ...prefs.translation, showOriginalWithTranslation: v } as any
            })}
            icon={Eye}
          />
        </div>
      </SectionCard>

      <div className="flex justify-end pt-4">
        <SaveButton onClick={handleSave} loading={saving} saved={saved} />
      </div>
    </div>
  );
}

// ============= 3. NOTIFICATIONS TAB =============

const defaultNotifs: settingsService.NotificationSettings = { email: { enabled: true, onNewChat: true, onMention: true, onAssignment: true, dailyDigest: false }, inApp: { enabled: true, sound: true, onNewMessage: true, onNewChat: true, onMention: true }, telegram: {
  enabled: false,
  onNewChat: false,
  onMention: false
}, desktop: { enabled: true, onNewMessage: true, onNewChat: true } };

function NotificationsContent() {
  const [notifs, setNotifs] = useState(defaultNotifs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { settingsService.getNotifications().then(data => setNotifs({...defaultNotifs, ...data})).finally(() => setLoading(false)); }, []);
  const handleSave = async () => { setSaving(true); try { await settingsService.updateNotifications(notifs); setSaved(true); setTimeout(() => setSaved(false), 2000); } catch {} setSaving(false); };

  if(loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin"/></div>;

  return (
    <div className="space-y-6">
      {/* Email Config */}
      <SectionCard title="Correo Electrónico" description="Alertas enviadas a tu email registrado.">
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
            <span className="text-zinc-200 font-medium">Habilitar Emails</span>
            <ToggleSwitch checked={notifs.email.enabled} onChange={(v) => setNotifs({...notifs, email: {...notifs.email, enabled: v}})} />
         </div>
         {notifs.email.enabled && (
             <div className="space-y-3">
                 <ToggleRow label="Nuevo chat asignado" checked={notifs.email.onAssignment} onChange={(v) => setNotifs({...notifs, email: {...notifs.email, onAssignment: v}})} small />
                 <ToggleRow label="Menciones (@tu)" checked={notifs.email.onMention} onChange={(v) => setNotifs({...notifs, email: {...notifs.email, onMention: v}})} small />
                 <ToggleRow label="Resumen diario" checked={notifs.email.dailyDigest} onChange={(v) => setNotifs({...notifs, email: {...notifs.email, dailyDigest: v}})} small />
             </div>
         )}
      </SectionCard>

      {/* In-App Config */}
      <SectionCard title="Notificaciones In-App" description="Alertas dentro del dashboard.">
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
            <span className="text-zinc-200 font-medium">Habilitar In-App</span>
            <ToggleSwitch checked={notifs.inApp.enabled} onChange={(v) => setNotifs({...notifs, inApp: {...notifs.inApp, enabled: v}})} />
         </div>
         {notifs.inApp.enabled && (
             <div className="space-y-3">
                 <ToggleRow label="Nuevos mensajes" checked={notifs.inApp.onNewMessage} onChange={(v) => setNotifs({...notifs, inApp: {...notifs.inApp, onNewMessage: v}})} small />
                 <ToggleRow label="Nuevos chats" checked={notifs.inApp.onNewChat} onChange={(v) => setNotifs({...notifs, inApp: {...notifs.inApp, onNewChat: v}})} small />
                 <ToggleRow label="Sonido de alerta" checked={notifs.inApp.sound} onChange={(v) => setNotifs({...notifs, inApp: {...notifs.inApp, sound: v}})} small />
             </div>
         )}
      </SectionCard>

      {/* Desktop Config (Restored!) */}
      <SectionCard title="Escritorio (Push)" description="Notificaciones del navegador.">
         <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
            <span className="text-zinc-200 font-medium">Habilitar Push</span>
            <ToggleSwitch checked={notifs.desktop.enabled} onChange={(v) => setNotifs({...notifs, desktop: {...notifs.desktop, enabled: v}})} />
         </div>
         {notifs.desktop.enabled && (
             <div className="space-y-3">
                 <ToggleRow label="Nuevos mensajes" checked={notifs.desktop.onNewMessage} onChange={(v) => setNotifs({...notifs, desktop: {...notifs.desktop, onNewMessage: v}})} small />
                 <ToggleRow label="Nuevos chats" checked={notifs.desktop.onNewChat} onChange={(v) => setNotifs({...notifs, desktop: {...notifs.desktop, onNewChat: v}})} small />
             </div>
         )}
      </SectionCard>

      <div className="flex justify-end pt-4"><SaveButton onClick={handleSave} loading={saving} saved={saved} /></div>
    </div>
  );
}

// ============= 4. SECURITY CONTENT =============

function SecurityContent() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [pwd, setPwd] = useState({ current: '', new: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => { loadSessions(); }, []);
  const loadSessions = async () => { try { const data = await settingsService.getSessions(); setSessions(data.sessions); } catch {} setLoading(false); };
  
  const handleChangePassword = async () => {
    if(pwd.new !== pwd.confirm) { setError('Las contraseñas no coinciden'); return; }
    if(pwd.new.length < 8) { setError('Mínimo 8 caracteres'); return; }
    setChanging(true); setError(''); setSuccess(false);
    try { await settingsService.changePassword(pwd.current, pwd.new); setSuccess(true); setPwd({ current: '', new: '', confirm: '' }); setTimeout(() => setSuccess(false), 3000); } 
    catch (e: any) { setError(e.message || 'Error al cambiar contraseña'); }
    finally { setChanging(false); }
  };

  const handleRevoke = async (id: string) => { try { await settingsService.revokeSession(id); setSessions(sessions.filter(s => s._id !== id)); } catch {} };
  const handleRevokeAll = async () => { try { await settingsService.revokeAllOtherSessions(); loadSessions(); } catch {} };

  return (
    <div className="space-y-6">
       {/* MFA Section */}
       <MFASettingsSection />

       <SectionCard title="Cambiar Contraseña" description="Actualiza tu clave de acceso periódicamente.">
          <div className="space-y-4 max-w-lg">
             <InputGroup label="Contraseña Actual" type="password" value={pwd.current} onChange={v => setPwd({...pwd, current: v})} />
             <InputGroup label="Nueva Contraseña" type="password" value={pwd.new} onChange={v => setPwd({...pwd, new: v})} />
             <InputGroup label="Confirmar Contraseña" type="password" value={pwd.confirm} onChange={v => setPwd({...pwd, confirm: v})} />
          </div>
          {error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}
          {success && <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-2"><Check className="w-4 h-4"/>Contraseña actualizada</div>}
          <div className="mt-6 flex justify-end">
             <SaveButton onClick={handleChangePassword} loading={changing} label="Actualizar Contraseña" />
          </div>
       </SectionCard>

       <SectionCard title="Sesiones Activas" description="Dispositivos donde has iniciado sesión.">
          <div className="flex justify-end mb-4 gap-2">
             <button onClick={loadSessions} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors"><RefreshCw className="w-4 h-4"/></button>
             {sessions.length > 1 && <button onClick={handleRevokeAll} className="text-xs text-red-400 hover:text-red-300 hover:underline">Cerrar todas las demás</button>}
          </div>
          {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500"/> : (
            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s._id} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${s.isCurrent ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-zinc-950 border-zinc-800'}`}>
                  <div className="flex items-center gap-4">
                     <div className={`p-2.5 rounded-xl border ${s.isCurrent ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
                        {s.deviceType === 'mobile' ? <Smartphone className="w-5 h-5"/> : <Laptop className="w-5 h-5"/>}
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <span className={`text-sm font-medium ${s.isCurrent ? 'text-zinc-50' : 'text-zinc-200'}`}>{s.os} • {s.browser}</span>
                           {s.isCurrent && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">Actual</span>}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{s.ip} • {new Date(s.lastSeenAt).toLocaleString()}</p>
                     </div>
                  </div>
                  {!s.isCurrent && <button onClick={() => handleRevoke(s._id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><LogOut className="w-4 h-4"/></button>}
                </div>
              ))}
            </div>
          )}
       </SectionCard>
    </div>
  );
}

// ============= 5. ACTIVITY CONTENT =============

function ActivityContent() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadActivity = async (p: number) => {
      setLoading(true);
      try { const data = await settingsService.getActivity(p, 20); setActivities(data.activities); setTotalPages(data.pages); setPage(p); } 
      catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadActivity(1); }, []);

  const getIcon = (type: string) => {
      if(type.includes('login')) return User;
      if(type.includes('logout')) return LogOut;
      if(type.includes('chat')) return MessageSquare;
      if(type.includes('password')) return Shield;
      return RefreshCw;
  };

  return (
    <div className="space-y-6">
        <SectionCard title="Historial de Actividad" description="Registro reciente de acciones en tu cuenta.">
            <div className="flex justify-end mb-4"><button onClick={() => loadActivity(page)} className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded"><RefreshCw className="w-4 h-4"/></button></div>
            {loading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin"/></div> : (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="divide-y divide-zinc-800">
                    {activities.map(a => {
                        const Icon = getIcon(a.type);
                        return (
                            <div key={a._id} className="p-4 flex items-start gap-4 hover:bg-zinc-900/50 transition-colors">
                                <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800"><Icon className="w-4 h-4"/></div>
                                <div className="flex-1">
                                    <p className="text-zinc-200 text-sm font-medium">{a.description}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 font-mono">
                                        <span>{new Date(a.createdAt).toLocaleString()}</span>
                                        <span>•</span>
                                        <span>{a.ip}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {activities.length === 0 && <div className="p-8 text-center text-zinc-500">No hay actividad reciente</div>}
                    </div>
                </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button onClick={() => loadActivity(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm disabled:opacity-50">Anterior</button>
                    <span className="px-4 py-2 text-zinc-500 text-sm">Página {page} de {totalPages}</span>
                    <button onClick={() => loadActivity(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm disabled:opacity-50">Siguiente</button>
                </div>
            )}
        </SectionCard>
    </div>
  );
}

// ============= 6. QUALITY QA CONTENT =============

const COACHING_TAG_LABELS: Record<string, string> = {
  tone_issue: 'Tono inadecuado',
  slow_response: 'Respuesta lenta',
  wrong_category: 'Categorización incorrecta',
  policy_violation: 'Violación de política',
  other: 'Otro',
};

function QualityContent() {
  const [performance, setPerformance] = useState<AgentQAPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await qaService.getMyPerformance();
      setPerformance(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos de calidad');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <span className="ml-3 text-zinc-400">Cargando rendimiento...</span>
      </div>
    );
  }

  if (error) {
    return (
      <SectionCard title="Error" description="No se pudieron cargar los datos">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
        <button onClick={loadPerformance} className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors">
          Reintentar
        </button>
      </SectionCard>
    );
  }

  if (!performance) return null;

  const scoreColor = performance.avgScore >= 90 ? 'text-emerald-400' : performance.avgScore >= 70 ? 'text-blue-400' : performance.avgScore >= 50 ? 'text-amber-400' : 'text-red-400';
  const scoreBg = performance.avgScore >= 90 ? 'bg-emerald-500/10 border-emerald-500/20' : performance.avgScore >= 70 ? 'bg-blue-500/10 border-blue-500/20' : performance.avgScore >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  // Trend direction
  const trend = performance.weeklyTrend;
  const lastTwo = trend.length >= 2 ? trend.slice(-2) : [];
  const trendDir = lastTwo.length === 2 ? (lastTwo[1] > lastTwo[0] ? 'up' : lastTwo[1] < lastTwo[0] ? 'down' : 'flat') : 'flat';

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${scoreBg} border rounded-2xl p-6 text-center`}>
          <p className="text-xs font-bold text-zinc-400 uppercase  mb-2">Puntaje Promedio</p>
          <p className={`text-4xl font-black ${scoreColor}`}>{performance.avgScore.toFixed(1)}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {trendDir === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
            {trendDir === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
            {trendDir === 'flat' && <Minus className="w-4 h-4 text-zinc-500" />}
            <span className={`text-xs ${trendDir === 'up' ? 'text-emerald-400' : trendDir === 'down' ? 'text-red-400' : 'text-zinc-500'}`}>
              {trendDir === 'up' ? 'Mejorando' : trendDir === 'down' ? 'Declinando' : 'Estable'}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <p className="text-xs font-bold text-zinc-400 uppercase  mb-2">Evaluaciones</p>
          <p className="text-4xl font-black text-zinc-50">{performance.totalReviews}</p>
          <p className="text-xs text-zinc-500 mt-2">{performance.recentReviews.length} recientes</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <p className="text-xs font-bold text-zinc-400 uppercase  mb-2">Pendientes</p>
          <p className={`text-4xl font-black ${performance.pendingAcknowledgements > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {performance.pendingAcknowledgements}
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            {performance.pendingAcknowledgements > 0 ? 'Requieren reconocimiento' : 'Todo al día'}
          </p>
        </div>
      </div>

      {/* Weekly Trend */}
      {trend.length > 0 && (
        <SectionCard title="Tendencia Semanal" description="Tu puntaje promedio por semana (últimas 4 semanas)">
          <div className="flex items-end gap-3 h-32">
            {trend.map((score, i) => {
              const height = Math.max(10, (score / 100) * 100);
              const barColor = score >= 90 ? 'bg-emerald-500' : score >= 70 ? 'bg-blue-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-zinc-400">{score.toFixed(0)}</span>
                  <div className={`w-full rounded-t-lg ${barColor} transition-all duration-500 opacity-80`} style={{ height: `${height}%` }} />
                  <span className="text-[10px] text-zinc-600">S{i + 1}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Recent Reviews */}
      <SectionCard title="Evaluaciones Recientes" description="Tus últimas evaluaciones de calidad">
        {performance.recentReviews.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <ClipboardCheck className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No tienes evaluaciones aún</p>
          </div>
        ) : (
          <div className="space-y-3">
            {performance.recentReviews.map((review: QAReview) => {
              const rScoreColor = review.totalScore >= 90 ? 'text-emerald-400 bg-emerald-500/10' : review.totalScore >= 70 ? 'text-blue-400 bg-blue-500/10' : review.totalScore >= 50 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';
              const reviewer = typeof review.reviewedBy === 'object' ? review.reviewedBy : null;
              return (
                <div key={review._id} className="flex items-center gap-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                  <div className={`px-3 py-2 rounded-xl font-black text-lg ${rScoreColor}`}>
                    {review.totalScore}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        Sesión {typeof review.sessionId === 'string' ? review.sessionId.substring(0, 8) : ''}...
                      </span>
                      {review.escalated && (
                        <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-bold rounded">ESCALADA</span>
                      )}
                      {!review.agentAcknowledged && (
                        <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded">PENDIENTE</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {reviewer && <span className="text-xs text-zinc-500">por {reviewer.name}</span>}
                      <span className="text-xs text-zinc-600">{new Date(review.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                    {review.coachingTags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {review.coachingTags?.map((tag, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded">
                            {COACHING_TAG_LABELS[tag] || tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {review.agentAcknowledged ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}


// ============= UI HELPERS (Premium Zinc) =============

function SectionCard({ title, description, children }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-zinc-50 tracking-tight">{title}</h3>
        <p className="text-sm text-zinc-400 mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}

function InputGroup({ label, icon: Icon, value, onChange, type = 'text', placeholder, className }: { label: string; icon?: any; value: string; onChange?: (v: string) => void; type?: string; placeholder?: string; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-xs font-bold text-zinc-500 uppercaseflex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </label>
      <input 
        type={type} 
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm placeholder-zinc-600" 
      />
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange, icon: Icon, small }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; icon?: any; small?: boolean }) {
    return (
        <div className={`flex items-center justify-between p-3 rounded-xl hover:bg-zinc-950/50 border border-transparent hover:border-zinc-800/50 transition-all cursor-pointer ${small ? 'py-2' : ''}`} onClick={() => onChange(!checked)}>
            <div className="flex items-center gap-3">
                {Icon && <div className={`p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 ${small ? 'p-1.5' : ''}`}><Icon className={`${small ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}/></div>}
                <div>
                    <p className={`text-zinc-200 font-medium ${small ? 'text-xs' : 'text-sm'}`}>{label}</p>
                    {desc && <p className="text-[10px] text-zinc-500 mt-0.5">{desc}</p>}
                </div>
            </div>
            <ToggleSwitch checked={checked} onChange={onChange} small={small} />
        </div>
    );
}

function ToggleSwitch({ checked, onChange, small }: { checked: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`relative inline-flex items-center rounded-full transition-colors border ${checked ? 'bg-indigo-600 border-indigo-600' : 'bg-zinc-950 border-zinc-700'} ${small ? 'h-5 w-9' : 'h-6 w-11'}`}
    >
      <span className={`inline-block bg-white rounded-full transition-transform shadow-sm ${small ? 'h-3 w-3' : 'h-4 w-4'} ${checked ? (small ? 'translate-x-5' : 'translate-x-6') : 'translate-x-1'}`} />
    </button>
  );
}

function SaveButton({ onClick, loading, saved, label = 'Guardar Cambios' }: any) {
    return (
        <button 
            onClick={onClick} 
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none ${saved ? 'bg-emerald-600 text-zinc-50' : 'bg-indigo-600 hover:bg-indigo-500 text-zinc-50 shadow-indigo-900/20'}`}
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
            {saved ? 'Guardado' : label}
        </button>
    );
}