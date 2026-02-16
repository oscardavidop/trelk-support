import { ArrowRight, Clock, Hourglass } from "lucide-react";
import { DELAY_LABELS, type DelayConfig } from "../../../types/flow";

const RenderDelayConfig = (config: DelayConfig, updateConfig: (field: string, value: any) => void, readOnly: boolean) => {
    const delayConfig = config as DelayConfig;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Delay Type Selector */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase  flex items-center gap-2">
                    <Hourglass className="w-3.5 h-3.5" /> Tipo de Espera
                </label>
                <div className="relative">
                    <select
                        value={delayConfig.delayType || ''}
                        onChange={(e) => updateConfig('delayType', e.target.value)}
                        disabled={readOnly}
                        className="w-full px-4 py-2.5 pl-10 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none outline-none transition-all cursor-pointer hover:border-zinc-700"
                    >
                        <option value="">Seleccionar...</option>
                        {Object.entries(DELAY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <div className="absolute left-3 top-3 text-zinc-500 pointer-events-none">
                        <Clock className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Fixed Time Config */}
            {delayConfig.delayType === 'fixed_time' && (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />

                    <label className="text-xs font-bold text-violet-400 uppercase">Duración Fija</label>
                    <div className="flex items-center gap-3 mt-2">
                        <input
                            type="number"
                            value={delayConfig.delayMinutes || 5}
                            onChange={(e) => updateConfig('delayMinutes', parseInt(e.target.value))}
                            disabled={readOnly}
                            min={1}
                            className="w-15 px-3 py-0 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 text-center font-mono text-lg focus:border-violet-500 outline-none transition-all"
                        />
                        <span className="text-sm text-zinc-400 font-medium">minutos</span>
                    </div>
                </div>
            )}

            {/* Until Response Config */}
            {delayConfig.delayType === 'until_response' && (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase  block mb-2">
                            Tiempo Límite (Timeout)
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                value={delayConfig.maxWaitMinutes || 30}
                                onChange={(e) => updateConfig('maxWaitMinutes', parseInt(e.target.value))}
                                disabled={readOnly}
                                min={1}
                                className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 text-center font-mono focus:border-indigo-500 outline-none"
                            />
                            <span className="text-sm text-zinc-400">minutos máx.</span>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                        <ArrowRight className="w-4 h-4 text-zinc-500 mt-0.5" />
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Si el usuario no responde en este tiempo, el flujo continuará automáticamente por la rama de "Timeout".
                        </p>
                    </div>
                </div>
            )}

            {/* Cancel Conditions Checkboxes */}
            <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-zinc-500 uppercase  ml-1">Condiciones de Cancelación</label>

                <label className="flex items-start gap-3 p-3 mt-3 rounded-xl border border-zinc-800 hover:bg-zinc-900/50 hover:border-zinc-700 cursor-pointer transition-all group">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            checked={delayConfig.cancelOnUserResponse || false}
                            onChange={(e) => updateConfig('cancelOnUserResponse', e.target.checked)}
                            disabled={readOnly}
                            className="peer h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-indigo-600 focus:ring-indigo-500/20 focus:ring-offset-0 outline-none"
                        />
                    </div>
                    
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-50 transition-colors">
                            Cancelar si el usuario escribe
                        </span>
                        <span className="text-xs text-zinc-500">
                            Interrumpe la espera si llega cualquier mensaje nuevo.
                        </span>
                    </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 hover:bg-zinc-900/50 hover:border-zinc-700 cursor-pointer transition-all group">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            checked={delayConfig.cancelOnChatClose || false}
                            onChange={(e) => updateConfig('cancelOnChatClose', e.target.checked)}
                            disabled={readOnly}
                            className="peer h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-indigo-600 focus:ring-indigo-500/20 focus:ring-offset-0"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-50 transition-colors">
                            Cancelar al cerrar chat
                        </span>
                        <span className="text-xs text-zinc-500">
                            Detiene el temporizador si la sesión se finaliza manualmente.
                        </span>
                    </div>
                </label>
            </div>

        </div>
    );
};

export default RenderDelayConfig;