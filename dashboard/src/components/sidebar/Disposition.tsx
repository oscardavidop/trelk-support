/**
 * SidebarDisposition - Premium Zinc Refactor
 * High-fidelity session disposition details for the sidebar
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2, Folder, FolderOpen, Tag as TagIcon,
  MessageSquare, Clock, AlertCircle, LayoutGrid
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

// ============= TYPES =============

interface DispositionData {
  categoryId?: string;
  categoryCode?: string;
  categoryName?: string;
  subcategoryId?: string;
  subcategoryCode?: string;
  subcategoryName?: string;
  comment?: string;
  tags?: string[];
  completedAt?: string;
}

interface DispositionTagInfo {
  _id: string;
  name: string;
  color: string;
  code: string;
}

interface SidebarDispositionProps {
  sessionId: string;
  disposition?: DispositionData;
  sessionStatus?: string;
}

// ============= COMPONENT =============

export function SidebarDisposition({ sessionId, disposition, sessionStatus }: SidebarDispositionProps) {
  const { token } = useAuthStore();
  const [tagDetails, setTagDetails] = useState<DispositionTagInfo[]>([]);

  useEffect(() => {
    if (disposition?.tags && disposition.tags.length > 0) {
      fetch('/api/admin/dispositions/tags', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.tags) {
            const relevantTags = data.tags.filter((t: DispositionTagInfo) =>
              disposition.tags?.includes(t.code)
            );
            setTagDetails(relevantTags);
          }
        })
        .catch(console.error);
    }
  }, [disposition?.tags, token]);

  // --- Empty State ---
  if (!disposition || !disposition.categoryId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 mx-4 my-2">
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-3 border border-zinc-800 shadow-sm">
          <AlertCircle className="w-5 h-5 text-zinc-600" />
        </div>
        <p className="text-sm font-medium text-zinc-400">Sin tipificación</p>
        <p className="text-xs text-zinc-600 mt-1 max-w-[200px]">
          {sessionStatus === 'closed'
            ? 'Esta sesión finalizó sin registro de cierre.'
            : 'Se solicitará al finalizar la sesión.'
          }
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="p-3 py-3 space-y-6">

      {/* 1. Categorization Group */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-1.5 px-1">
          <LayoutGrid className="w-3 h-3" /> Clasificación
        </h4>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/50">

          {/* Category Item */}
          <div className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
              <Folder className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-zinc-500 font-medium">Categoría</p>
              <p className="text-sm font-semibold text-zinc-200 truncate">
                {disposition.categoryName || disposition.categoryCode || 'General'}
              </p>
            </div>
          </div>

          {/* Subcategory Item */}
          {disposition.subcategoryName && (
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shrink-0">
                <FolderOpen className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-zinc-500 font-medium">Subcategoría</p>
                <p className="text-sm font-semibold text-zinc-200 truncate">
                  {disposition.subcategoryName}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Tags Section */}
      {tagDetails.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-1.5 px-1">
            <TagIcon className="w-3 h-3" /> Etiquetas
          </h4>
          <div className="flex flex-wrap gap-2">
            {tagDetails.map(tag => (
              <span
                key={tag._id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all"
                style={{
                  backgroundColor: `${tag.color}10`,
                  color: tag.color,
                  borderColor: `${tag.color}20`
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Comment Section */}
      {disposition.comment && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-1.5 px-1">
            <MessageSquare className="w-3 h-3" /> Observaciones
          </h4>
          {/* bajar si es muy largo */}
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl max-h-32 overflow-x-auto custom-scrollbar">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
              {disposition.comment}
            </p>
          </div>
        </div>
      )}

      {/* 4. Footer Metadata */}
      {disposition.completedAt && (
        <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Registrado el:
            </span>
            <span className="text-zinc-300 font-mono">
              {formatDate(disposition.completedAt)}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-emerald-500 uppercase ">
              Tipificación Completada
            </span>
          </div>
        </div>
      )}

    </div>
  );
}

export default SidebarDisposition;