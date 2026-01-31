import React from 'react';
import { 
  Mic, 
  Music, 
  Trash2, 
  AudioLines 
} from 'lucide-react';
import type { AudioBlock, BlockEditorProps } from "../../../types/flow";
import FileUpload from "../FileUpload";
import { MessagePreview } from "../MessagePreview";
import { BlockKeyboardEditor } from "./BlockKeyboardEditor";

export const AudioBlockEditor: React.FC<BlockEditorProps<AudioBlock>> = ({
    block,
    onChange,
    onDelete,
    readOnly,
}) => {
    const isVoiceNote = block.isVoiceNote || false;

    return (
        <div className="group bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all shadow-sm">
            
            {/* 1. Header Toolbar */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${
                        isVoiceNote 
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                            : 'bg-pink-500/10 border-pink-500/20 text-pink-400'
                    }`}>
                        {isVoiceNote ? <Mic className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-xs font-bold text-zinc-300">
                        {isVoiceNote ? 'Nota de Voz' : 'Archivo de Audio'}
                    </span>
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
                        mediaType="audio"
                        value={block.url || ''}
                        onChange={(url) => onChange({ url })}
                        disabled={readOnly}
                    />
                </div>

                {/* Voice Note Toggle Card */}
                <label className={`
                    flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${isVoiceNote 
                        ? 'bg-blue-500/5 border-blue-500/30' 
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    }
                `}>
                    <div className="mt-0.5">
                        <input
                            type="checkbox"
                            checked={isVoiceNote}
                            onChange={(e) => onChange({ isVoiceNote: e.target.checked })}
                            disabled={readOnly}
                            className={`rounded bg-zinc-950 border-zinc-700 ${
                                isVoiceNote ? 'text-blue-500 focus:ring-blue-500' : 'text-zinc-500'
                            }`}
                        />
                    </div>
                    <div className="flex-1">
                        <div className={`text-xs font-bold flex items-center gap-2 ${
                            isVoiceNote ? 'text-blue-300' : 'text-zinc-300'
                        }`}>
                            {isVoiceNote ? <AudioLines className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
                            {isVoiceNote ? 'Enviar como Nota de Voz' : 'Enviar como Archivo MP3'}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                            {isVoiceNote 
                                ? 'Se mostrará con el reproductor circular nativo de Telegram (waveform).' 
                                : 'Se mostrará como un archivo adjunto descargable con título y artista.'}
                        </p>
                    </div>
                </label>

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
                    />
                </div>
            </div>
        </div>
    );
};