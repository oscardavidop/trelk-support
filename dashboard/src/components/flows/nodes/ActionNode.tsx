/**
 * ActionNode - Premium Zinc Refactor
 * Flow action node with dynamic button routing handles
 */

import React, { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  MessageSquare, CalendarClock, ArrowRightLeft, UserCog,
  FolderInput, Tag, StickyNote, Ban, Webhook, Code2,
  Database, XCircle, RotateCcw, ClipboardList,
  MessageCircleQuestion, ListStart, PenLine, Eraser,
  Workflow, MoreHorizontal, Zap, Layers, Reply,
  KeyboardOff,
  LucideKeyboard
} from 'lucide-react';

import type {
  ActionConfig,
  ActionType,
  KeyboardButton,
  MessageBlock,
  TextBlock
} from '../../../types/flow';
import { ACTION_LABELS } from '../../../types/flow';
import NodeWrapper from './NodeWrapper';

// --- Interfaces & Helpers ---

interface ActionNodeData {
  label: string;
  config: ActionConfig;
}

// Helper: Extract all buttons from config
function extractAllButtons(config: ActionConfig): KeyboardButton[] {
  const buttons: KeyboardButton[] = [];

  // From message blocks
  if (config.messageBlocks) {
    for (const block of config.messageBlocks) {
      // Cast genérico seguro para acceder a propiedades comunes
      const anyBlock = block as any;
      if (anyBlock.keyboard?.rows) {
        for (const row of anyBlock.keyboard.rows) {
          for (const btn of row.buttons) {
            buttons.push(btn);
          }
        }
      }
    }
  }

  // From legacy keyboard
  if (config.keyboard?.rows) {
    for (const row of config.keyboard.rows) {
      for (const btn of row.buttons) {
        buttons.push(btn);
      }
    }
  }

  return buttons;
}

// Helper: Get Icon and Color Theme based on Action Type
const getActionVisuals = (type?: ActionType ) => {
  switch (type) {
    case 'send_message': return { icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    case 'schedule_message': return { icon: CalendarClock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    case 'transfer_chat': return { icon: ArrowRightLeft, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' };
    case 'assign_agent': return { icon: UserCog, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' };
    case 'change_category': return { icon: FolderInput, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' };
    case 'add_tag': return { icon: Tag, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    case 'remove_tag': return { icon: Tag, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    case 'create_note': return { icon: StickyNote, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
    case 'block_user': return { icon: Ban, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    case 'call_webhook': return { icon: Webhook, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' };
    case 'api_call': return { icon: Code2, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' };
    case 'set_custom_field': return { icon: Database, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' };
    case 'close_chat': return { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
    case 'reopen_chat': return { icon: RotateCcw, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    case 'send_survey': return { icon: ClipboardList, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' };
    case 'wait_for_response': return { icon: MessageCircleQuestion, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
    case 'add_to_queue': return { icon: ListStart, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    case 'edit_message': return { icon: PenLine, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    case 'delete_message': return { icon: Eraser, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    case 'run_subflow': return { icon: Workflow, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
    case 'remove_keyboard': return { icon: KeyboardOff, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    case 'edit_keyboard': return { icon: LucideKeyboard, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    default: return { icon: Zap, color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' };
  }
};

// --- Component ---

function ActionNode({ data, selected, id }: NodeProps<ActionNodeData>) {
  const actionType = data.config?.actionType;
  const visuals = getActionVisuals(actionType);
  const Icon = visuals.icon;
  const actionLabel = actionType ? (ACTION_LABELS[actionType] || actionType) : 'Acción';

  // 1. Extract buttons for handles
  const buttons = useMemo(() => {
    if (!data.config) return [];
    return extractAllButtons(data.config);
  }, [data.config]);

  // 2. Filter buttons that need handles (continue or goto_node)
  const buttonHandles = useMemo(() => {
    return buttons.filter(btn => {
      const mode = btn.onClick?.mode || 'continue';
      return mode === 'continue' || mode === 'goto_node';
    });
  }, [buttons]);

  const hasButtons = (actionType === 'send_message' || actionType === 'send_survey') && buttonHandles.length > 0;

  // 3. Preview Logic
  const getActionPreview = () => {
    if (!data.config) return null;

    switch (actionType) {
      case 'send_message':
        const textBlock = data.config.messageBlocks?.find((b: any) => b.type === 'text') as TextBlock | undefined;
        // Prioritize block content, fallback to legacy
        const text = textBlock?.content || data.config.messageContent;
        const blockCount = data.config.messageBlocks?.length || 0;

        if (text) {
          return (
            <div className="space-y-1">
              <div className="relative pl-2 border-l-2 border-zinc-700">
                <p className="text-[10px] text-zinc-400 italic truncate max-w-[180px] leading-tight">
                  "{text.substring(0, 50)}{text.length > 50 ? '...' : ''}"
                </p>
              </div>
              {blockCount > 1 && (
                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                  <Layers className="w-3 h-3" /> +{blockCount - 1} bloques más
                </div>
              )}
            </div>
          );
        }
        return <span className="text-[10px] text-zinc-500 italic">Mensaje sin texto</span>;

      case 'add_tag':
      case 'remove_tag':
        return data.config.tagName ? (
          <div className="flex items-center gap-2 mt-1">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold text-zinc-50 shadow-sm"
              style={{ backgroundColor: data.config.tagColor || (actionType === 'add_tag' ? '#3B82F6' : '#EF4444') }}
            >
              {data.config.tagName}
            </span>
          </div>
        ) : null;

      case 'call_webhook':
        return data.config.webhookUrl ? (
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 mt-1">
            <span className={`text-[9px] font-bold ${data.config.webhookMethod === 'POST' ? 'text-blue-400' : 'text-emerald-400'}`}>
              {data.config.webhookMethod || 'POST'}
            </span>
            <span className="text-[10px] text-zinc-500 truncate max-w-[140px] font-mono">
              {(() => { try { return new URL(data.config.webhookUrl).pathname; } catch { return '...'; } })()}
            </span>
          </div>
        ) : null;

      case 'schedule_message':
        return data.config.scheduleDelay ? (
          <div className="flex items-center gap-1.5 mt-1 text-amber-400/80 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
            <CalendarClock className="w-3 h-3" />
            <span className="text-[10px] font-medium">Espera: {data.config.scheduleDelay} min</span>
          </div>
        ) : null;

      case 'set_custom_field':
        return data.config.customFieldName ? (
          <div className="flex flex-col gap-0.5 mt-1">
            <span className="text-[9px] text-zinc-500 font-mono bg-zinc-900 px-1 rounded w-fit">
              {data.config.customFieldName}
            </span>
            <span className="text-[10px] text-violet-400 font-bold truncate">
              = {data.config.customFieldValue}
            </span>
          </div>
        ) : null;

      default:
        return (
          <div className="text-[10px] text-zinc-500 italic mt-1">
            {data.config.description || 'Sin configuración adicional'}
          </div>
        );
    }
  };

  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          relative flex flex-col
          bg-zinc-950 
          rounded-xl shadow-2xl 
          border-[1.5px] min-w-[240px] max-w-[260px]
          transition-all duration-200
          ${selected
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-zinc-800 hover:border-zinc-700'
          }
        `}
      >
        {/* --- INPUT HANDLE --- */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !-top-1.5 !bg-zinc-200 !border-2 !border-zinc-950 transition-transform hover:scale-125 hover:!bg-indigo-400"
        />

        {/* --- HEADER --- */}
        <div className={`p-3 rounded-t-xl border-b border-zinc-800/50 flex items-center gap-3 bg-zinc-900/30`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg border ${visuals.bg} ${visuals.border} ${visuals.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase r text-zinc-500 mb-0.5">
              {actionLabel}
            </div>
            <div className="font-bold text-zinc-200 text-xs leading-tight truncate">
              {data.label || 'Nodo de Acción'}
            </div>
          </div>
        </div>

        {/* --- BODY PREVIEW --- */}
        <div className="p-3">
          {getActionPreview()}

          {/* LISTA DE BOTONES (Salidas Dinámicas) */}
          {hasButtons && (
            <div className="mt-3 pt-3 border-t border-zinc-800/50 space-y-2">
              {buttonHandles.map((btn) => (
                <div
                  key={btn.id}
                  className="relative flex items-center justify-between bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg group hover:border-indigo-500/30 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Reply className="w-3 h-3 text-zinc-600 rotate-180 scale-y-[-1]" />
                    <span className="text-[10px] font-medium text-zinc-300 truncate max-w-[160px]">
                      {btn.text}
                    </span>
                  </div>

                  {/* Handle Right */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`btn-${btn.id}`}
                    className={`!w-2.5 !h-2.5 !border-2 !border-zinc-950 !bg-indigo-500 transition-transform group-hover:scale-125`}
                    style={{ right: '-14px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              ))}

              {buttonHandles.length === 0 && (
                <div className="text-[9px] text-zinc-600 text-center italic">Sin botones conectables</div>
              )}
            </div>
          )}
        </div>

        {/* --- OUTPUT HANDLE DEFAULT --- */}
        {/* Solo mostrar si NO hay botones o si la acción permite continuar de todos modos (ej. schedule) */}
        {(!hasButtons) && (
          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
            <Handle
              type="source"
              position={Position.Bottom}
              id="default"
              className="!relative !transform-none !w-3 !h-3 !bg-zinc-200 !border-2 !border-zinc-950 transition-transform hover:scale-125 hover:!bg-indigo-400"
            />
          </div>
        )}

      </div>
    </NodeWrapper>
  );
}

export default memo(ActionNode);