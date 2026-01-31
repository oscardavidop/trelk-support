/**
 * ActionNode - Flow action node component
 * Now with dynamic button handles for flow routing
 */

import React, { memo, useMemo } from 'react';
import type { JSX } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type {
  ActionConfig,
  ActionType,
  KeyboardButton,
  MessageBlock,
  TextBlock,
  ImageBlock,
  DocumentBlock,
  AudioBlock,
  VideoBlock
} from '../../../types/flow';
import { ACTION_LABELS } from '../../../types/flow';
import NodeWrapper from './NodeWrapper';

// --- Interfaces & Helpers ---

interface ActionNodeData {
  label: string;
  config: ActionConfig;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

// Extract all buttons from message blocks that have onClick actions
function extractAllButtons(config: ActionConfig): KeyboardButton[] {
  const buttons: KeyboardButton[] = [];

  // From message blocks
  if (config.messageBlocks) {
    for (const block of config.messageBlocks) {
      const typedBlock = block as TextBlock | ImageBlock | DocumentBlock | AudioBlock | VideoBlock;
      if ('keyboard' in typedBlock && typedBlock.keyboard?.rows) {
        for (const row of typedBlock.keyboard.rows) {
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

const getActionIcon = (actionType: ActionType) => {
  const icons: Record<ActionType, JSX.Element> = {
    send_message: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    schedule_message: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    transfer_chat: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    assign_agent: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    change_category: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    add_tag: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    remove_tag: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    create_note: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    block_user: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    call_webhook: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    api_call: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    set_custom_field: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    close_chat: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    reopen_chat: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    send_survey: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    escalate: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    wait_for_response: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    add_to_queue: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    // === NEW TELEGRAM ACTIONS ===
    edit_message: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    delete_message: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    edit_keyboard: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth={2}/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
      </svg>
    ),
    remove_keyboard: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth={2}/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 10h.01M18 10h.01M8 14h8M3 3l18 18" />
      </svg>
    ),
    send_reply_keyboard: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="2" y="14" width="20" height="6" rx="1" strokeWidth={2}/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 17h.01M10 17h.01M14 17h.01M18 17h.01M12 3v8m0 0l-3-3m3 3l3-3" />
      </svg>
    ),
    remove_reply_keyboard: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="2" y="14" width="20" height="6" rx="1" strokeWidth={2}/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
      </svg>
    ),
    send_chat_action: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth={2}/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01" />
      </svg>
    ),
    pin_message: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
    unpin_message: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5zM3 3l18 18" />
      </svg>
    ),
    save_message_id: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
    ),
    delay_action: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    send_location: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    send_contact: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    send_sticker: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    copy_message: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    run_subflow: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    ),
  };
  return icons[actionType] || (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
};

// --- Component ---

function ActionNode({ data, selected, id }: NodeProps<ActionNodeData>) {
  const actionType = data.config?.actionType;
  const actionLabel = actionType ? (ACTION_LABELS[actionType] || actionType) : 'Acción';

  // Extract buttons for dynamic handles
  const buttons = useMemo(() => {
    if (!data.config) return [];
    return extractAllButtons(data.config);
  }, [data.config]);

  // Only show button handles for buttons with goto_node or continue mode
  const buttonHandles = useMemo(() => {
    return buttons.filter(btn => {
      const mode = btn.onClick?.mode || 'continue';
      return mode === 'continue' || mode === 'goto_node';
    });
  }, [buttons]);

  const hasButtons = actionType === 'send_message' && buttonHandles.length > 0;

  // --- Preview Logic ---
  const getActionPreview = () => {
    if (!data.config) return null;

    switch (actionType) {
      case 'send_message':
        const textBlock = data.config.messageBlocks?.find((b: any) => b.type === 'text') as TextBlock | undefined;
        const text = textBlock?.content || data.config.messageContent;

        if (text) {
          return (
            <div className="relative pl-3 border-l-2 border-blue-300 dark:border-blue-700">
              <p className="text-xs text-gray-600 dark:text-gray-300 italic truncate max-w-[180px]">
                "{text.substring(0, 40)}{text.length > 40 ? '...' : ''}"
              </p>
            </div>
          );
        }
        return (
          <div className="mt-2 text-xs text-gray-400 italic">
            {data.config.messageBlocks?.length || 0} bloques configurados
          </div>
        );

      case 'add_tag':
      case 'remove_tag':
        return data.config.tagName ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-gray-400 uppercase">{actionType === 'add_tag' ? 'Añadir:' : 'Quitar:'}</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium text-white shadow-sm"
              style={{ backgroundColor: data.config.tagColor || '#3B82F6' }}
            >
              {data.config.tagName}
            </span>
          </div>
        ) : null;

      case 'call_webhook':
        return data.config.webhookUrl ? (
          <div className="mt-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-1.5 rounded border border-gray-100 dark:border-gray-700">
            <span className={`text-[10px] font-bold px-1 rounded ${data.config.webhookMethod === 'POST' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>
              {data.config.webhookMethod || 'POST'}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
              {(() => {
                try { return new URL(data.config.webhookUrl).hostname; }
                catch { return data.config.webhookUrl; }
              })()}
            </span>
          </div>
        ) : null;

      case 'schedule_message':
        return data.config.scheduleDelay ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
            <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Espera: <b>{data.config.scheduleDelay} min</b></span>
          </div>
        ) : null;

      default:
        return (
          <div className="text-xs text-gray-600 dark:text-gray-400 italic">
            {actionLabel}
          </div>
        );
    }
  };

  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          relative flex flex-col
          bg-white dark:bg-gray-900 
          rounded-xl shadow-xl 
          border-2 min-w-[240px] max-w-[280px]
          transition-all duration-200
          ${selected
            ? 'border-blue-500 ring-4 ring-blue-500/20'
            : 'border-blue-400/60 dark:border-blue-600/60 hover:border-blue-500'
          }
        `}
      >
        {/* --- INPUT HANDLE --- */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-4 !h-4 !-top-2 !bg-blue-500 !border-2 !border-white dark:!border-gray-900 transition-transform hover:scale-125"
        />

        {/* --- HEADER --- */}
        <div className="bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-900 p-3 rounded-t-xl border-b border-blue-100 dark:border-blue-800/50 flex items-center gap-3">
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-lg shadow-sm border
            ${selected
              ? 'bg-blue-500 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700'
            }
          `}>
            {getActionIcon(actionType) || (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">
              {data.label || 'Acción'}
            </div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercasemt-0.5 truncate">
              {actionLabel}
            </div>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="p-3">
          {getActionPreview()}

          {/* LISTA DE BOTONES (Si existen) */}
          {hasButtons && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 ">Opciones</span>
                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 rounded-full">{buttonHandles.length}</span>
              </div>

              <div className="space-y-2">
                {buttonHandles.slice(0, 4).map((btn, index) => (
                  <div
                    key={btn.id}
                    className="relative flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 px-2 py-1.5 rounded-md group hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className={`w-1.5 h-1.5 rounded-full ${btn.onClick?.mode === 'goto_node' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">
                        {btn.text}
                      </span>
                    </div>
                    <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>

                    {/* HANDLE INTEGRADO EN EL BOTÓN */}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`btn-${btn.id}`}
                      className={`!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-800 ${btn.onClick?.mode === 'goto_node' ? '!bg-purple-500' : '!bg-blue-500'}`}
                      style={{ right: '-14px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </div>
                ))}
                {buttonHandles.length > 4 && (
                  <div className="text-center text-[10px] text-gray-400 italic">
                    + {buttonHandles.length - 4} opciones más...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- HANDLE DE SALIDA POR DEFECTO --- */}
        {/* Solo se muestra si NO hay botones, para flujo continuo */}
        {!hasButtons && (
          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
            <Handle
              type="source"
              position={Position.Bottom}
              id="default"
              className="!relative !transform-none !w-3.5 !h-3.5 !bg-blue-500 !border-2 !border-white dark:!border-gray-900 transition-transform hover:scale-125 shadow-sm"
            />
          </div>
        )}
      </div>
    </NodeWrapper>
  );
}

export default memo(ActionNode);