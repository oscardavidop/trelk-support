import { useState } from 'react';
import { X, Bookmark, Loader2, Check, AlertCircle, Zap, Tag } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface SaveReplyModalProps {
  content: string;
  onSave: () => void;
  onClose: () => void;
}

export default function SaveReplyModal({ content, onSave, onClose }: SaveReplyModalProps) {
  const token = useAuthStore((state) => state.token);
  
  const [title, setTitle] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [category, setCategory] = useState('General');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { setError('El título es requerido'); return; }

    setIsSaving(true); setError(null);

    try {
      const res = await fetch('/api/saved-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          shortcut: shortcut.trim() || undefined,
          category: category.trim() || undefined,
          isActive: true,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(true);
        setTimeout(() => onSave(), 1000);
      } else {
        setError(data.error || 'Error al guardar');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    } finally {
      setIsSaving(false);
    }
  };

  const categories = ['General', 'Saludos', 'FAQ', 'Soporte', 'Pagos', 'Técnico'];

  return (
    // is modal
    // fix, se ve mocha partida en la mitad de la pantalla
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-inner">
              <Bookmark className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Guardar Respuesta</h2>
              <p className="text-xs text-zinc-400">Crear nuevo atajo de texto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {success ? (
            <div className="py-12 text-center animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">¡Guardado!</h3>
              <p className="text-zinc-500 text-sm">La respuesta está lista para usarse.</p>
            </div>
          ) : (
            <>
              {/* Preview Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Contenido Original
                </label>
                <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 text-sm text-zinc-300 italic leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                  "{content}"
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Título <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Bienvenida"
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Atajo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">/</span>
                    <input
                      type="text"
                      value={shortcut}
                      onChange={(e) => setShortcut(e.target.value.replace(/\s/g, '').toLowerCase())}
                      placeholder="hola"
                      className="w-full pl-7 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                   <Tag className="w-3 h-3"/> Categoría
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                        category === cat
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="O escribe una nueva..."
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>

              {/* Error Alert */}
              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium animate-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar Respuesta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}