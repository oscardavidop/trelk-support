/**
 * MessageEditor - Advanced message configuration for Flow Builder
 * Supports blocks (text, image, document, audio, video, delay) and keyboards
 */

import React, { useState, useMemo } from 'react';
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
import { MessagePreview } from './MessagePreview';
import { FileUpload } from './FileUpload';
import {
  Type, Image as ImageIcon, FileText, Mic, Video,
  Clock, AlertTriangle, Plus, Languages, Layers
} from 'lucide-react';
import I18nConfigPanel from './components/I18nConfigPanel';

function detectTextKeys(blocks: MessageBlock[]): string[] {
  const keys = new Set<string>();
  const textPattern = /\{\{TEXT\.([A-Z0-9_]+)\}\}/g;

  for (const block of blocks) {
    // Check text content
    if ('content' in block && block.content) {
      let match;
      while ((match = textPattern.exec(block.content)) !== null) {
        keys.add(match[1]);
      }
    }
    // Check caption
    if ('caption' in block && block.caption) {
      let match;
      while ((match = textPattern.exec(block.caption)) !== null) {
        keys.add(match[1]);
      }
    }
    // Check button texts in keyboard
    if ('keyboard' in block && block.keyboard?.rows) {
      for (const row of block.keyboard.rows) {
        for (const btn of row.buttons) {
          if (btn.text) {
            let match;
            while ((match = textPattern.exec(btn.text)) !== null) {
              keys.add(match[1]);
            }
          }
        }
      }
    }
  }

  return Array.from(keys);
}


// Helper function to extract all buttons from blocks and check for issues
function getButtonValidation(blocks: MessageBlock[]): { hasWarnings: boolean; warnings: string[] } {
  const warnings: string[] = [];

  for (const block of blocks) {
    if ('keyboard' in block && block.keyboard?.rows) {
      for (const row of block.keyboard.rows) {
        for (const btn of row.buttons) {
          const mode = btn.onClick?.mode || 'continue';

          // Check for buttons with goto_node but no target
          if (mode === 'goto_node' && !btn.onClick?.targetNodeId && !btn.targetNodeId) {
            warnings.push(`El botón "${btn.text}" tiene acción "Ir a nodo" pero no tiene nodo destino configurado`);
          }

          // Check for buttons with goto_flow but no target
          if (mode === 'goto_flow' && !btn.onClick?.targetFlowId && !btn.targetFlowId) {
            warnings.push(`El botón "${btn.text}" tiene acción "Ir a flow" pero no tiene flow destino configurado`);
          }

          // Check for URL buttons without URL
          if (mode === 'url' && !btn.onClick?.url && !btn.url) {
            warnings.push(`El botón "${btn.text}" tiene acción "Abrir URL" pero no tiene URL configurada`);
          }
        }
      }
    }
  }

  return { hasWarnings: warnings.length > 0, warnings };
}


import {
  TextBlockEditor,
  
} from './components/TextBlockEditor';
import { ImageBlockEditor } from './components/ImageBlockEditor';
import { DocumentBlockEditor } from './components/DocumentBlockEditor';
import { AudioBlockEditor } from './components/AudioBlockEditor';
import { VideoBlockEditor } from './components/VideoBlockEditor';
import { DelayBlockEditor } from './components/DelayBlockEditor';
const BLOCK_TYPES = [
  { type: 'text', label: 'Texto', icon: Type, color: 'text-zinc-300' },
  { type: 'image', label: 'Imagen', icon: ImageIcon, color: 'text-purple-400' },
  { type: 'audio', label: 'Audio', icon: Mic, color: 'text-pink-400' },
  { type: 'video', label: 'Video', icon: Video, color: 'text-sky-400' },
  { type: 'document', label: 'Archivo', icon: FileText, color: 'text-orange-400' },
  { type: 'delay', label: 'Espera', icon: Clock, color: 'text-yellow-400' },
] as const;

const MessageEditor: React.FC<MessageEditorProps> = ({ config, onChange, readOnly, nodes = [], flows = [] }) => {
  const blocks = config.messageBlocks || [];

  // Validation & Helpers
  const validation = useMemo(() => getButtonValidation(blocks), [blocks]);
  const detectedTextKeys = useMemo(() => detectTextKeys(blocks), [blocks]);
  const hasI18nTexts = detectedTextKeys.length > 0;

  // Initialize legacy content
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
  const addBlock = (type: MessageBlock['type']) => {
    const newBlock: Partial<MessageBlock> = { id: Date.now().toString(), type };

    // Init defaults
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
    const commonProps = {
      onDelete: () => deleteBlock(index),
      onInsertVariable: () => { }, // Tu lógica aquí
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
        <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl animate-in slide-in-from-top-2">
          <Languages className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-indigo-300">Internacionalización Detectada</h4>
            {/* Aquí renderizarías tu I18nConfigPanel interno si es pequeño, o un botón para abrirlo */}
            <I18nConfigPanel config={config} onChange={onChange} detectedTextKeys={detectedTextKeys} readOnly={readOnly} />
          </div>
        </div>
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

      {/* 3. Block Stack (Timeline) */}
      <div className="space-y-4 relative">
        {/* Timeline Line Decorator */}
        {blocks.length > 1 && (
          <div className="absolute left-4 top-4 bottom-4 w-px bg-zinc-800 -z-10" />
        )}

        {blocks.map((block, index) => (
          <div key={block.id} className="relative animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Block Content */}
            {renderBlockEditor(block, index)}
          </div>
        ))}

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
