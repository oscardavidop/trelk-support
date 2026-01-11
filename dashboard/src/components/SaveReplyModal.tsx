// Save Reply Modal - Save current message as a quick reply
import { useState } from 'react';
import { X, Bookmark, Loader2, Check, AlertCircle, Zap } from 'lucide-react';
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
  const [category, setCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/saved-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        setTimeout(() => {
          onSave();
        }, 1000);
      } else {
        setError(data.error || 'Error al guardar la respuesta');
      }
    } catch (err) {
      console.error('Failed to save reply:', err);
      setError('Error de conexión');
    } finally {
      setIsSaving(false);
    }
  };

  // Suggested categories
  const categories = ['Saludos', 'FAQ', 'Soporte', 'Pagos', 'Técnico', 'Otros'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Bookmark className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Guardar Respuesta Rápida</h2>
              <p className="text-sm text-gray-500">Disponible al escribir /</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Success state */}
          {success ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">¡Guardado!</h3>
              <p className="text-gray-500">La respuesta ya está disponible</p>
            </div>
          ) : (
            <>
              {/* Preview */}
              <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm text-gray-400">Contenido de la respuesta</span>
                </div>
                <p className="text-white text-sm whitespace-pre-wrap line-clamp-4">
                  {content}
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Título <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Saludo inicial, Respuesta FAQ..."
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 
                             focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  autoFocus
                />
              </div>

              {/* Shortcut */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Atajo (opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">/</span>
                  <input
                    type="text"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value.replace(/\s/g, '').toLowerCase())}
                    placeholder="saludo"
                    className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 
                               focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Escribe /{shortcut || 'atajo'} para insertar rápidamente
                </p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categoría (opcional)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        category === cat
                          ? 'bg-primary text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
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
                  placeholder="O escribe una categoría personalizada..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 
                             focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  Guardar respuesta
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
