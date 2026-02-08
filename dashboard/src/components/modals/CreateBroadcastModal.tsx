import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Info, Loader2, Megaphone, Pin, Send, X } from "lucide-react";
import { useState } from "react";
import api from "../../services/api";
interface Broadcast {
  _id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  targetAudience: 'all' | 'role' | 'team' | 'individual';
  targetRoles?: string[];
  requireAck: boolean;
  isPinned: boolean;
  expiresAt?: string;
  createdBy: { _id: string; name: string; };
  cancelledAt?: string;
  stats?: { totalTargeted: number; delivered: number; seen: number; acknowledged: number; };
  createdAt: string;
}


const LEVEL_STYLES = {
  info: {
    icon: Info,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    glow: 'shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)]'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    glow: 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]'
  },
  critical: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    glow: 'shadow-[0_0_15px_-3px_rgba(248,113,113,0.15)]'
  },
};


export const CreateBroadcastModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ isOpen, onClose, onCreated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<Broadcast['level']>('info');
  const [targetAudience, setTargetAudience] = useState<'all' | 'role'>('all');
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [requireAck, setRequireAck] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const availableRoles = ['agent', 'supervisor', 'admin'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return setError('Faltan campos requeridos');
    
    setLoading(true); setError(null);
    try {
      const payload: any = { 
        title, message, level, targetAudience, requireAck, isPinned,
        targetRoles: targetAudience === 'role' ? targetRoles : undefined,
        expiresAt: hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : undefined
      };
      
      const { data } = await api.post<{ok: boolean, error?: string}>('/api/internal-broadcasts', payload);
      if (data.ok) {
        onCreated(); onClose();
        setTitle(''); setMessage(''); setLevel('info');
      } else if (data?.error) setError(data.error);
    } catch (err: any) { setError(err.message); } 
    finally { setLoading(false); }
  };

  const toggleRole = (role: string) => {
    setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Nuevo Anuncio</h2>
              <p className="text-xs text-zinc-500">Comunicación interna para el equipo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          <form id="create-broadcast-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Main Info */}
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase r">Título</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Resumen del anuncio"
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase r">Mensaje</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe los detalles aquí..."
                    rows={6}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {/* Right Column: Settings */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase r">Nivel</label>
                  <div className="flex flex-col gap-2">
                    {(['info', 'warning', 'critical'] as const).map((l) => {
                      const style = LEVEL_STYLES[l];
                      const Icon = style.icon;
                      const isSelected = level === l;
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setLevel(l)}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                            isSelected 
                              ? `${style.bg} ${style.border} ${style.color} ring-1 ring-inset ring-white/10` 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase ">{l}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase r">Audiencia</label>
                  <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    {(['all', 'role'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTargetAudience(type)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          targetAudience === type 
                            ? 'bg-zinc-800 text-white shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {type === 'all' ? 'Todos' : 'Roles'}
                      </button>
                    ))}
                  </div>
                  {targetAudience === 'role' && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {availableRoles.map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRole(role)}
                          className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md border transition-colors ${
                            targetRoles.includes(role)
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800">
               {/* Checkbox Component Style */}
               {[
                 { label: 'Requerir Firma', sub: 'Confirmación obligatoria', checked: requireAck, set: setRequireAck, icon: CheckCircle2 },
                 { label: 'Fijar Mensaje', sub: 'Mantener visible arriba', checked: isPinned, set: setIsPinned, icon: Pin },
                 { label: 'Expiración', sub: 'Fecha límite automática', checked: hasExpiry, set: setHasExpiry, icon: Clock }
               ].map((item, idx) => (
                 <label key={idx} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${item.checked ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}>
                    <div className={`mt-0.5 p-1 rounded-md ${item.checked ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-600'}`}>
                       <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                       <div className="flex justify-between">
                          <span className={`text-xs font-bold uppercase  ${item.checked ? 'text-indigo-200' : 'text-zinc-400'}`}>{item.label}</span>
                          <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} className="hidden" />
                       </div>
                       <p className="text-[10px] text-zinc-500 mt-0.5">{item.sub}</p>
                    </div>
                 </label>
               ))}
            </div>

            {hasExpiry && (
               <div className="animate-in fade-in slide-in-from-top-2">
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:border-indigo-500 outline-none"
                  />
               </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs font-medium animate-in slide-in-from-top-2">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors uppercase ">
            Cancelar
          </button>
          <button
            type="submit"
            form="create-broadcast-form"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase  rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
};