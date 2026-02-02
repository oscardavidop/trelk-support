import React from 'react';
import { 
  Video, 
  Trash2, 
  Captions, 
  Code,
  Film
} from 'lucide-react';
import type { BlockEditorProps, VideoBlock, ParseMode } from "../../../types/flow";
import FileUpload from "../FileUpload";
import { MessagePreview } from "../MessagePreview";
import { BlockKeyboardEditor } from "./BlockKeyboardEditor";

// Estilos base consistentes
const inputBase = "bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 outline-none transition-all placeholder-zinc-600";

export const VideoBlockEditor: React.FC<BlockEditorProps<VideoBlock>> = ({
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
                    <div className="p-1.5 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sky-400">
                        <Video className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300">Mensaje de Video</span>
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
                
                {/* File Upload */}
                <div className="space-y-2">
                    <FileUpload
                        mediaType="video"
                        value={block.url || ''}
                        onChange={(url) => onChange({ url })}
                        disabled={readOnly}
                    />
                    
                    {/* Video Preview Container */}
                    {block.url && (
                        <div className="relative w-full bg-black rounded-lg border border-zinc-800 overflow-hidden mt-2 group/video">
                            <video 
                                src={block.url} 
                                className="h-48 object-contain" 
                                controls 
                                onError={(e) => (e.currentTarget.style.display = 'none')} 
                            />
                            {/* Overlay icon if no poster/thumbnail */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover/video:opacity-100 transition-opacity">
                                <Film className="w-8 h-8 text-white/20" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Caption Input Section */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-1.5">
                            <Captions className="w-3 h-3" /> Pie de foto (Caption)
                        </label>
                        
                        {/* Parse Mode Selector */}
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
                        placeholder="Escribe una descripción para el video..."
                    />
                </div>
            </div>

            {/* 3. Footer / Preview / Keyboard */}
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