import React, { useRef, useState } from 'react';
import { 
  Type, 
  Trash2, 
  Code, 
  Braces,
  MessageSquare
} from 'lucide-react';
import type { BlockEditorProps, TextBlock, ParseMode } from "../../../types/flow";
import { MessagePreview } from "../MessagePreview";
import { BlockKeyboardEditor } from "./BlockKeyboardEditor";
import { VariableSelector } from './VariableSelector';


export const TextBlockEditor: React.FC<BlockEditorProps<TextBlock>> = ({
    block,
    onChange,
    onDelete,
    // onInsertVariable se usa internamente via el selector
    readOnly,
    nodes = [],
    flows = [],
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleInsertVariable = (variable: string) => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const text = block.content || '';
            const newText = text.substring(0, start) + variable + text.substring(end);
            onChange({ content: newText });
            
            // Recuperar foco (pequeño hack para React state updates)
            setTimeout(() => {
                if(textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.setSelectionRange(start + variable.length, start + variable.length);
                }
            }, 0);
        } else {
            onChange({ content: (block.content || '') + variable });
        }
    };

    return (
        <div className="group bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all shadow-sm">
            
            {/* 1. Header Toolbar */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                        <Type className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300">Mensaje de Texto</span>
                </div>

                {!readOnly && (
                    <button 
                        onClick={onDelete} 
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar bloque"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* 2. Unified Editor Area */}
            <div className="flex flex-col">
                
                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={block.content || ''}
                    onChange={(e) => onChange({ content: e.target.value })}
                    disabled={readOnly}
                    rows={4}
                    className="w-full px-4 py-3 bg-zinc-950 text-sm text-zinc-200 placeholder-zinc-700 border-none outline-none resize-y min-h-[100px] leading-relaxed font-sans focus:ring-0"
                    placeholder="Escribe el contenido del mensaje..."
                />

                {/* Internal Toolbar (Bottom of textarea) */}
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-t border-zinc-800">
                    
                    {/* Parse Mode Selector */}
                    <div className="flex items-center gap-2">
                        <Code className="w-3.5 h-3.5 text-zinc-500" />
                        <select
                            value={block.parseMode || ''}
                            onChange={(e) => onChange({ parseMode: (e.target.value || undefined) as ParseMode })}
                            disabled={readOnly}
                            className="bg-transparent text-[10px] font-bold text-zinc-500 hover:text-zinc-300 focus:text-indigo-400 outline-none cursor-pointer transition-colors appearance-none uppercase "
                            title="Formato de texto"
                        >
                            <option value="">Texto Plano</option>
                            <option value="Markdown">Markdown</option>
                            <option value="MarkdownV2">Markdown V2</option>
                            <option value="HTML">HTML</option>
                        </select>
                    </div>

                    {/* Variable Selector Trigger */}
                    <div className="flex items-center">
                        <div className="h-4 w-px bg-zinc-800 mx-2" />
                        <VariableSelector onSelect={handleInsertVariable} />
                    </div>
                </div>
            </div>

            {/* 3. Helpers & Badges */}
            <div className="px-4 pt-2">
                {/* Visual Feedback for Variables */}
                {block.content && block.content.includes('{{') && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {block.content.match(/\{\{[^}]+\}\}/g)?.map((v, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded text-[9px] font-mono flex items-center gap-1">
                                <Braces className="w-2 h-2 opacity-50" /> {v.replace(/[{}]/g, '')}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. Footer / Preview / Keyboard */}
            <div className="px-4 pb-4 space-y-4">
                {/* Live Preview Component */}
                <div className="opacity-80 hover:opacity-100 transition-opacity">
                    <MessagePreview blocks={[block]} />
                </div>

                <div className="border-t border-zinc-800 pt-3">
                    <BlockKeyboardEditor
                        keyboard={block.keyboard}
                        onChange={(keyboard) => onChange({ keyboard })}
                        readOnly={readOnly}
                        nodes={nodes}
                        flows={flows}
                    />
                </div>
            </div>
        </div>
    );
};