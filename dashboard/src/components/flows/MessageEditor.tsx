/**
 * MessageEditor - Advanced message configuration for Flow Builder
 * Supports blocks (text, image, document, audio, video, delay) and keyboards
 * NOW WITH DRAG & DROP SUPPORT
 */

import React, { useMemo } from 'react';
import type {
  MessageBlock,
  TextBlock,
  ImageBlock,
  DocumentBlock,
  AudioBlock,
  VideoBlock,
  DelayBlock,
  MessageEditorProps,
} from '../../types/flow';
import {
  Type, Image as ImageIcon, FileText, Mic, Video,
  Clock, AlertTriangle, Plus, Languages, Layers,
  GripVertical, // Nuevo icono para el agarre
  GripHorizontal
} from 'lucide-react';
import I18nConfigPanel from './components/I18nConfigPanel';

// --- IMPORTS PARA DRAG & DROP ---
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- COMPONENTES EDITORES EXISTENTES ---
import { TextBlockEditor } from './components/TextBlockEditor';
import { ImageBlockEditor } from './components/ImageBlockEditor';
import { DocumentBlockEditor } from './components/DocumentBlockEditor';
import { AudioBlockEditor } from './components/AudioBlockEditor';
import { VideoBlockEditor } from './components/VideoBlockEditor';
import { DelayBlockEditor } from './components/DelayBlockEditor';

// --- UTILIDADES ---
function detectTextKeys(blocks: MessageBlock[]): string[] {
  const keys = new Set<string>();
  const textPattern = /\{\{TEXT\.([A-Z0-9_]+)\}\}/g;
  for (const block of blocks) {
    if ('content' in block && block.content) {
      let match;
      while ((match = textPattern.exec(block.content)) !== null) keys.add(match[1]);
    }
    if ('caption' in block && block.caption) {
      let match;
      while ((match = textPattern.exec(block.caption)) !== null) keys.add(match[1]);
    }
    if ('keyboard' in block && block.keyboard?.rows) {
      for (const row of block.keyboard.rows) {
        for (const btn of row.buttons) {
          if (btn.text) {
            let match;
            while ((match = textPattern.exec(btn.text)) !== null) keys.add(match[1]);
          }
        }
      }
    }
  }
  return Array.from(keys);
}

function getButtonValidation(blocks: MessageBlock[]): { hasWarnings: boolean; warnings: string[] } {
  const warnings: string[] = [];
  for (const block of blocks) {
    if ('keyboard' in block && block.keyboard?.rows) {
      for (const row of block.keyboard.rows) {
        for (const btn of row.buttons) {
          const mode = btn.onClick?.mode || 'continue';
          if (mode === 'goto_node' && !btn.onClick?.targetNodeId && !btn.targetNodeId) {
            warnings.push(`El botón "${btn.text}" tiene acción "Ir a nodo" pero no tiene nodo destino configurado`);
          }
          if (mode === 'goto_flow' && !btn.onClick?.targetFlowId && !btn.targetFlowId) {
            warnings.push(`El botón "${btn.text}" tiene acción "Ir a flow" pero no tiene flow destino configurado`);
          }
          if (mode === 'url' && !btn.onClick?.url && !btn.url) {
            warnings.push(`El botón "${btn.text}" tiene acción "Abrir URL" pero no tiene URL configurada`);
          }
        }
      }
    }
  }
  return { hasWarnings: warnings.length > 0, warnings };
}

const BLOCK_TYPES = [
  { type: 'text', label: 'Texto', icon: Type, color: 'text-zinc-300' },
  { type: 'image', label: 'Imagen', icon: ImageIcon, color: 'text-purple-400' },
  { type: 'audio', label: 'Audio', icon: Mic, color: 'text-pink-400' },
  { type: 'video', label: 'Video', icon: Video, color: 'text-sky-400' },
  { type: 'document', label: 'Archivo', icon: FileText, color: 'text-orange-400' },
  { type: 'delay', label: 'Espera', icon: Clock, color: 'text-yellow-400' },
] as const;

// --- COMPONENTE WRAPPER SORTABLE ACTUALIZADO ---
const SortableBlock = ({ id, children, readOnly }: { id: string, children: React.ReactNode, readOnly?: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className={`group relative ${isDragging ? 'opacity-70' : ''}`}>

      {/* Handle de arrastre INTEGRADO EN EL HEADER */}
      {!readOnly && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-3 left-50 z-10 cursor-grab active:cursor-grabbing p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 rounded-md transition-all touch-none"
          title="Arrastrar para reordenar"
        >
          <GripHorizontal className="w-4 h-4" /> {/* Icono ligeramente más pequeño */}
        </div>
      )}

      {/* Contenido del bloque (El editor en sí) */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const MessageEditor: React.FC<MessageEditorProps> = ({ config, onChange, readOnly, nodes = [], flows = [] }) => {
  const blocks = config.messageBlocks || [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Validation & Helpers
  const validation = useMemo(() => getButtonValidation(blocks), [blocks]);
  const detectedTextKeys = useMemo(() => detectTextKeys(blocks), [blocks]);
  const hasI18nTexts = detectedTextKeys.length > 0;

  React.useEffect(() => {
    if (!config.messageBlocks && config.messageContent) {
      onChange({
        messageBlocks: [{
          id: Date.now().toString(),
          type: 'text',
          content: config.messageContent,
        } as TextBlock],
      });
    }
  }, []);

  // Handlers
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((block) => block.id === active.id);
      const newIndex = blocks.findIndex((block) => block.id === over.id);

      onChange({
        messageBlocks: arrayMove(blocks, oldIndex, newIndex),
      });
    }
  };

  const addBlock = (type: MessageBlock['type']) => {
    // ... (sin cambios aquí)
    const newBlock: Partial<MessageBlock> = { id: Date.now().toString(), type };
    if (type === 'text') (newBlock as TextBlock).content = '';
    if (type === 'image') (newBlock as ImageBlock).url = '';
    if (type === 'document') (newBlock as DocumentBlock).url = '';
    if (type === 'audio') (newBlock as AudioBlock).url = '';
    if (type === 'video') (newBlock as VideoBlock).url = '';
    if (type === 'delay') (newBlock as DelayBlock).seconds = 1;
    onChange({ messageBlocks: [...blocks, newBlock as MessageBlock] });
  };

  const updateBlock = (index: number, updates: Partial<MessageBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates } as MessageBlock;
    onChange({ messageBlocks: newBlocks });
  };

  const deleteBlock = (index: number) => {
    onChange({ messageBlocks: blocks.filter((_, i) => i !== index) });
  };

  const renderBlockEditor = (block: MessageBlock, index: number) => {
    // ... (sin cambios aquí)
    const commonProps = {
      onDelete: () => deleteBlock(index),
      onInsertVariable: () => { },
      readOnly,
      nodes,
      flows,
    };

    switch (block.type) {
      case 'text': return <TextBlockEditor key={block.id} block={block as TextBlock} onChange={(u) => updateBlock(index, u)} {...commonProps} />;
      case 'image': return <ImageBlockEditor key={block.id} block={block as ImageBlock} onChange={(u) => updateBlock(index, u)} {...commonProps} />;
      case 'document': return <DocumentBlockEditor key={block.id} block={block as DocumentBlock} onChange={(u) => updateBlock(index, u)} {...commonProps} />;
      case 'audio': return <AudioBlockEditor key={block.id} block={block as AudioBlock} onChange={(u) => updateBlock(index, u)} {...commonProps} />;
      case 'video': return <VideoBlockEditor key={block.id} block={block as VideoBlock} onChange={(u) => updateBlock(index, u)} {...commonProps} />;
      case 'delay': return <DelayBlockEditor key={block.id} block={block as DelayBlock} onChange={(u) => updateBlock(index, u)} {...commonProps} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 w-full">

      {/* 1. i18n Banner */}
      {hasI18nTexts && (
        <I18nConfigPanel config={config} onChange={onChange} detectedTextKeys={detectedTextKeys} readOnly={readOnly} />
      )}

      {/* 2. Validation Warnings */}
      {validation.hasWarnings && (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-400 uppercase">Atención requerida</h4>
            <ul className="text-[10px] text-amber-200/80 list-disc list-inside space-y-0.5">
              {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* 3. Block Stack (Timeline + Drag & Drop) */}
      <div className="space-y-4 relative"> {/* Añadido un pequeño padding izquierdo al contenedor */}
        {/* Timeline Line Decorator - Regresada a su posición original */}
        {blocks.length > 1 && (
          <div className="absolute left-4 top-4 bottom-4 w-px bg-zinc-800 -z-10" />
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block, index) => (
              <SortableBlock key={block.id} id={block.id} readOnly={readOnly}>
                {renderBlockEditor(block, index)}
              </SortableBlock>
            ))}
          </SortableContext>
        </DndContext>

        {/* Empty State */}
        {blocks.length === 0 && !readOnly && (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-600 bg-zinc-900/20">
            <Layers className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs font-medium">El mensaje está vacío</p>
            <p className="text-[10px]">Añade bloques usando el menú de abajo</p>
          </div>
        )}
      </div>

      {/* 4. Add Block Toolbox */}
      {!readOnly && (
        <div className="space-y-2 pt-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-3 h-3" /> Añadir Contenido
          </label>

          <div className="grid grid-cols-3 gap-2">
            {BLOCK_TYPES.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => addBlock(item.type as any)}
                className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 rounded-xl transition-all group"
              >
                <item.icon className={`w-5 h-5 ${item.color} group-hover:scale-110 transition-transform`} />
                <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-200">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default MessageEditor;