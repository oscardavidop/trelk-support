import React from 'react';
import { 
  Clock, 
  Trash2, 
  Hourglass
} from 'lucide-react';
import type { BlockEditorProps, DelayBlock } from "../../../types/flow";

export const DelayBlockEditor: React.FC<BlockEditorProps<DelayBlock>> = ({
    block,
    onChange,
    onDelete,
    readOnly,
}) => {
    const seconds = block.seconds || 1;
    const maxSeconds = 60;
    
    // Calcular porcentaje para la barra visual (max 60s)
    const percentage = Math.min((seconds / maxSeconds) * 100, 100);

    return (
        <div className="group bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all shadow-sm">
            
            {/* 1. Header Toolbar */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300">Pausa (Delay)</span>
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
            <div className="p-4">
                <div className="flex items-center gap-4">
                    
                    {/* Numeric Input */}
                    <div className="relative">
                        <input
                            type="number"
                            value={seconds}
                            onChange={(e) => onChange({ seconds: Math.max(1, Math.min(60, parseInt(e.target.value) || 1)) })}
                            disabled={readOnly}
                            min={1}
                            max={60}
                            className="w-20 pl-3 pr-1 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono text-center focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                        />
                        <span className="absolute -right-8 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-medium">seg</span>
                    </div>

                    {/* Visual Timeline/Slider Representation */}
                    <div className="flex-1 flex flex-col justify-center gap-1.5">
                        <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                            <div 
                                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300 rounded-full"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-zinc-600 uppercase r font-medium mt-3">
                            <span>Breve</span>
                            <span>Largo (60s)</span>
                        </div>
                    </div>

                </div>

                {/* Info Text */}
                <div className="mt-3 flex items-start gap-2 p-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                    <Hourglass className="w-3 h-3 text-amber-500/60 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-zinc-500 leading-tight">
                        Muestra el estado <span className="text-amber-500/80 font-medium">"escribiendo..."</span> durante {seconds} segundos antes de enviar el siguiente mensaje.
                    </p>
                </div>
            </div>
        </div>
    );
};