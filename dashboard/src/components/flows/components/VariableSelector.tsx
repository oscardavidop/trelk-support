import React, { useState } from "react";
import { 
  Braces, 
  Database, 
  Globe, 
  Plus, 
  Search, 
  X,
  ChevronRight
} from "lucide-react";

interface VariableSelectorProps {
    onSelect: (variable: string) => void;
}

const AVAILABLE_VARIABLES = [
    { path: 'user.firstName', label: 'Nombre', description: 'Nombre del usuario', category: 'user' },
    { path: 'user.lastName', label: 'Apellido', description: 'Apellido del usuario', category: 'user' },
    { path: 'user.username', label: 'Username', description: '@username', category: 'user' },
    { path: 'user.id', label: 'User ID', description: 'ID de Telegram', category: 'user' },
    { path: 'user.language', label: 'Idioma', description: 'Código de idioma (es, en)', category: 'user' },
    { path: 'message.content', label: 'Mensaje', description: 'Texto del último mensaje', category: 'message' },
    { path: 'date', label: 'Fecha', description: 'Fecha actual (YYYY-MM-DD)', category: 'system' },
    { path: 'time', label: 'Hora', description: 'Hora actual (HH:MM)', category: 'system' },
];

const COMMON_TEXT_KEYS = [
    { key: 'WELCOME', description: 'Bienvenida' },
    { key: 'GOODBYE', description: 'Despedida' },
    { key: 'ERROR', description: 'Error General' },
    { key: 'HELP', description: 'Ayuda' },
];

export const VariableSelector: React.FC<VariableSelectorProps> = ({ onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'variables' | 'texts'>('variables');
    const [customTextKey, setCustomTextKey] = useState('');

    return (
        <div className="relative inline-block text-left">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase r rounded-lg transition-all border
                    ${isOpen 
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                        : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600'
                    }
                `}
            >
                <Braces className="w-3 h-3" />
                <span>Variables</span>
            </button>

            {/* Backdrop (Invisible overlay to close on click outside) */}
            {isOpen && (
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
            )}

            {/* Popover Menu */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-72 origin-bottom-left bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/5">
                    
                    {/* Header Tabs */}
                    <div className="flex border-b border-zinc-800 bg-zinc-900/50">
                        <button
                            type="button"
                            onClick={() => setActiveTab('variables')}
                            className={`flex-1 py-2.5 text-[10px] font-bold uppercase r flex items-center justify-center gap-2 transition-all border-b-2 ${
                                activeTab === 'variables' 
                                    ? 'text-indigo-400 bg-zinc-900 border-indigo-500' 
                                    : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-900/50'
                            }`}
                        >
                            <Database className="w-3.5 h-3.5" /> Variables
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('texts')}
                            className={`flex-1 py-2.5 text-[10px] font-bold uppercase r flex items-center justify-center gap-2 transition-all border-b-2 ${
                                activeTab === 'texts' 
                                    ? 'text-purple-400 bg-zinc-900 border-purple-500' 
                                    : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-900/50'
                            }`}
                        >
                            <Globe className="w-3.5 h-3.5" /> Textos i18n
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1 bg-zinc-950">
                        
                        {/* --- Tab: Variables --- */}
                        {activeTab === 'variables' && (
                            AVAILABLE_VARIABLES.map((v) => (
                                <button
                                    key={v.path}
                                    type="button"
                                    onClick={() => {
                                        onSelect(`{{${v.path}}}`);
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-900 group transition-all flex items-center justify-between border border-transparent hover:border-zinc-800"
                                >
                                    <div>
                                        <div className="text-xs font-medium text-zinc-300 group-hover:text-zinc-50 flex items-center gap-1.5">
                                            {v.label}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5 group-hover:text-indigo-400/80">
                                            {`{{${v.path}}}`}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500" />
                                </button>
                            ))
                        )}

                        {/* --- Tab: Texts i18n --- */}
                        {activeTab === 'texts' && (
                            <div className="space-y-3 pb-1">
                                {/* Custom Key Input */}
                                <div className="p-1">
                                    <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1.5 block  px-1">Clave Personalizada</label>
                                    <div className="flex gap-1.5">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                            <input
                                                type="text"
                                                value={customTextKey}
                                                onChange={(e) => setCustomTextKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                                placeholder="EJ_BIENVENIDA"
                                                className="w-full pl-8 pr-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] text-zinc-50 font-mono uppercase focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder-zinc-700"
                                                autoFocus
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (customTextKey) {
                                                    onSelect(`{{TEXT.${customTextKey}}}`);
                                                    setIsOpen(false);
                                                    setCustomTextKey('');
                                                }
                                            }}
                                            disabled={!customTextKey}
                                            className="px-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-zinc-50 rounded-md flex items-center justify-center transition-colors shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="h-px bg-zinc-800 mx-2" />

                                {/* Common Keys List */}
                                <div>
                                    <label className="px-2 text-[9px] font-bold text-zinc-600 uppercase mb-1 block ">Claves Comunes</label>
                                    {COMMON_TEXT_KEYS.map((t) => (
                                        <button
                                            key={t.key}
                                            type="button"
                                            onClick={() => {
                                                onSelect(`{{TEXT.${t.key}}}`);
                                                setIsOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-900 group transition-all flex items-center justify-between border border-transparent hover:border-zinc-800"
                                        >
                                            <div>
                                                <div className="text-xs font-medium text-zinc-300 group-hover:text-zinc-50">
                                                    {t.description}
                                                </div>
                                                <div className="text-[10px] text-zinc-500 font-mono group-hover:text-purple-400">
                                                    {`{{TEXT.${t.key}}}`}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};