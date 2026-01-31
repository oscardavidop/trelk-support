import React from 'react';
import { 
  Image as ImageIcon, 
  Trash2, 
  Code, 
  Captions,
  Settings2
} from 'lucide-react';
import type { BlockEditorProps, ImageBlock, ParseMode } from "../../../types/flow";
import FileUpload from "../FileUpload"; // Asumiendo que este componente ya existe o se adapta
import { BlockKeyboardEditor } from "./BlockKeyboardEditor";
import { MessagePreview } from '../MessagePreview';

// Estilos base para inputs (Consistente con el sistema)
const inputBase = "bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder-zinc-600";

export const ImageBlockEditor: React.FC<BlockEditorProps<ImageBlock>> = ({
    block,
    onChange,
    onDelete,
    readOnly,
    nodes = [],
    flows = [],
}) => {
    return (
        <div className="group bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all shadow-sm">
            
            {/* 1. Header Toolbar */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400">
                        <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300">Mensaje de Imagen</span>
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

            {/* 2. Content Area */}
            <div className="p-4 space-y-4">
                
                {/* File Upload Wrapper */}
                <div className="space-y-2">
                    <FileUpload
                        mediaType="image"
                        value={block.url || ''}
                        onChange={(url) => onChange({ url })}
                        disabled={readOnly}
                        // Aquí podrías pasar clases para estilizar el FileUpload interno si lo soporta
                    />
                    
                    {/* Image Preview (Small thumbnail if URL exists) */}
                    {block.url && (
                        <div className="relative w-full h-32 bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden flex items-center justify-center">
                            <img 
                                src={block.url} 
                                alt="Preview" 
                                className="h-full object-contain" 
                                onError={(e) => (e.currentTarget.style.display = 'none')} 
                            />
                        </div>
                    )}
                </div>

                {/* Caption Input */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Captions className="w-3 h-3" /> Pie de foto (Caption)
                        </label>
                        
                        {/* Parse Mode Selector (Inline with label for compactness) */}
                        <div className="flex items-center gap-1">
                            <Code className="w-3 h-3 text-zinc-600" />
                            <select
                                value={block.parseMode || ''}
                                onChange={(e) => onChange({ parseMode: (e.target.value || undefined) as ParseMode })}
                                disabled={readOnly}
                                className="bg-transparent text-[10px] font-medium text-zinc-500 focus:text-zinc-300 outline-none cursor-pointer hover:bg-zinc-900 rounded px-1 py-0.5 transition-colors appearance-none text-right"
                                title="Formato de texto"
                            >
                                <option value="">Texto Plano</option>
                                <option value="Markdown">Markdown</option>
                                <option value="MarkdownV2">Markdown V2</option>
                                <option value="HTML">HTML</option>
                            </select>
                        </div>
                    </div>
                    
                    <input
                        type="text"
                        value={block.caption || ''}
                        onChange={(e) => onChange({ caption: e.target.value })}
                        disabled={readOnly}
                        className={`${inputBase} w-full px-3 py-2`}
                        placeholder="Escribe una descripción..."
                    />
                </div>
            </div>

            {/* 3. Footer / Keyboard / Preview */}
            <div className="px-4 pb-4 pt-0 space-y-4">
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