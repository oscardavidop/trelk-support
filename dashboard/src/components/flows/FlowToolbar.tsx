import React, { useState } from 'react';
import type { FlowStatus } from '../../types/flow';
import { 
  ArrowLeft, Undo2, Redo2, Save, Play, Pause, 
  MoreVertical, History, Trash2, Maximize, PanelRightClose, PanelRightOpen,
  CheckCircle2, Clock, PlayCircle
} from 'lucide-react';

interface FlowToolbarProps {
  flowName: string;
  flowStatus: FlowStatus;
  hasChanges: boolean;
  isLoading: boolean;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onSimulate: () => void;
  onClose: () => void;
  onCenterView: () => void;
  onTogglePalette: () => void;
  onVersionHistory: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isPaletteOpen: boolean;
  readOnly?: boolean;
  lastSaved?: Date | null;
}

const FlowToolbar: React.FC<FlowToolbarProps> = ({
  flowName,
  flowStatus,
  hasChanges,
  isLoading,
  onSave,
  onPublish,
  onUnpublish,
  onSimulate,
  onClose,
  onCenterView,
  onTogglePalette,
  onVersionHistory,
  onDelete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isPaletteOpen,
  readOnly = false,
  lastSaved,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const getStatusBadge = () => {
    const styles: Record<FlowStatus, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-zinc-800', text: 'text-zinc-400', label: 'Borrador' },
      published: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Publicado' },
      archived: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Archivado' },
      disabled: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Desactivado' },
    };
    const style = styles[flowStatus] || styles.draft;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-transparent ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    if (diff < 60000) return 'hace un momento';
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
    return lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 select-none relative z-20">
      
      {/* Left: Navigation & Info */}
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          title="Volver al dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white tracking-tight">{flowName}</h1>
          {getStatusBadge()}
          
          {hasChanges ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20 animate-pulse">
              {isLoading ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"/> : <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>}
              {isLoading ? 'Guardando...' : 'Sin guardar'}
            </span>
          ) : lastSaved ? (
            <span className="hidden sm:flex items-center gap-1.5 text-[12px] text-zinc-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Guardado {formatLastSaved()}
            </span>
          ) : null}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-zinc-800 mx-2 hidden sm:block" />

        {/* Undo/Redo */}
        {!readOnly && (
          <div className="hidden sm:flex items-center gap-1">
            <button onClick={onUndo} disabled={!canUndo} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Deshacer (Ctrl+Z)">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={onRedo} disabled={!canRedo} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Rehacer (Ctrl+Shift+Z)">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Center: View Controls */}
      <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
        <button
          onClick={onTogglePalette}
          className={`p-1.5 rounded-md transition-colors ${isPaletteOpen ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          title={isPaletteOpen ? 'Ocultar panel' : 'Mostrar panel'}
        >
          {isPaletteOpen ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
        </button>
        <button
          onClick={onCenterView}
          className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          title="Centrar vista"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        
        {/* Simulate */}
        <button onClick={onSimulate} disabled={isLoading} className="flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-700 transition-all text-xs font-medium">
          <PlayCircle className="w-4 h-4 text-indigo-400" />
          <span className="hidden sm:inline">Simular</span>
        </button>

        {!readOnly && (
          <>
            {/* Save */}
            <button 
              onClick={onSave} 
              disabled={isLoading || !hasChanges} 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all text-xs font-bold
                ${hasChanges 
                  ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed opacity-70'}
              `}
            >
              <Save className="w-4 h-4" />
              <span>Guardar</span>
            </button>

            {/* Publish Toggle */}
            {flowStatus === 'published' ? (
              <button onClick={onUnpublish} disabled={isLoading} className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg transition-all text-xs font-bold">
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar</span>
              </button>
            ) : (
              <button onClick={onPublish} disabled={isLoading || hasChanges} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 rounded-lg transition-all text-xs font-bold shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Publicar</span>
              </button>
            )}

            {/* Context Menu */}
            <div className="relative">
              <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
              
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-20 overflow-hidden ring-1 ring-white/10 animate-in fade-in slide-in-from-top-1">
                    <button onClick={() => { onVersionHistory(); setShowMoreMenu(false); }} className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 transition-colors">
                      <History className="w-4 h-4 text-zinc-500" /> Historial de versiones
                    </button>
                    <div className="h-px bg-zinc-800 my-1" />
                    <button onClick={() => { onDelete(); setShowMoreMenu(false); }} className="w-full px-4 py-2.5 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors">
                      <Trash2 className="w-4 h-4" /> Eliminar flujo
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FlowToolbar;