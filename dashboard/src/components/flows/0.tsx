import React, { useState } from 'react';
import { 
  Braces, 
  Globe, 
  Plus, 
  Search,
  Database
} from 'lucide-react';

interface VariableSelectorProps {
    onSelect: (variable: string) => void;
}

const AVAILABLE_VARIABLES = [
    { path: 'user.firstName', label: 'Nombre', description: 'Nombre del usuario' },
    { path: 'user.lastName', label: 'Apellido', description: 'Apellido del usuario' },
    { path: 'user.username', label: 'Username', description: '@username de Telegram' },
    { path: 'user.id', label: 'User ID', description: 'ID de Telegram' },
    { path: 'user.language', label: 'Idioma', description: 'Idioma del usuario' },
    { path: 'message.content', label: 'Mensaje', description: 'Contenido del último mensaje' },
    { path: 'date', label: 'Fecha', description: 'Fecha actual (YYYY-MM-DD)' },
    { path: 'time', label: 'Hora', description: 'Hora actual (HH:MM)' },
];

const COMMON_TEXT_KEYS = [
    { key: 'WELCOME_MESSAGE', description: 'Bienvenida' },
    { key: 'GOODBYE_MESSAGE', description: 'Despedida' },
    { key: 'ERROR_MESSAGE', description: 'Error Genérico' },
    { key: 'HELP_MESSAGE', description: 'Ayuda' },
];

export const VariableSelector: React.FC<VariableSelectorProps> = ({ onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'variables' | 'texts'>('variables');
    const [customTextKey, setCustomTextKey] = useState('');

    return (
        <div className="relative">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                    isOpen 
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' 
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-600'
                }`}
            >
                <Braces className="w-3.5 h-3.5" />
                <span>Variables</span>
            </button>

            {/* Popover Content */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    
                    <div className="absolute bottom-full right-0 mb-2 w-72 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* Header Tabs */}
                        <div className="flex border-b border-zinc-800 bg-zinc-900/50">
                            <button
                                type="button"
                                onClick={() => setActiveTab('variables')}
                                className={`flex-1 py-2.5 text-[10px] font-bold uppercase r flex items-center justify-center gap-2 transition-colors ${
                                    activeTab === 'variables' 
                                        ? 'text-indigo-400 bg-zinc-900 border-b-2 border-indigo-500' 
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <Database className="w-3.5 h-3.5" /> Variables
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('texts')}
                                className={`flex-1 py-2.5 text-[10px] font-bold uppercase r flex items-center justify-center gap-2 transition-colors ${
                                    activeTab === 'texts' 
                                        ? 'text-purple-400 bg-zinc-900 border-b-2 border-purple-500' 
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <Globe className="w-3.5 h-3.5" /> Textos i18n
                            </button>
                        </div>

                        {/* List Content */}
                        <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                            
                            {/* --- Variables Tab --- */}
                            {activeTab === 'variables' && (
                                AVAILABLE_VARIABLES.map((v) => (
                                    <button
                                        key={v.path}
                                        type="button"
                                        onClick={() => {
                                            onSelect(`{{${v.path}}}`);
                                            setIsOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-900 group transition-all"
                                    >
                                        <div className="text-xs font-medium text-zinc-300 group-hover:text-white">
                                            {v.label}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-mono group-hover:text-indigo-400">
                                            {`{{${v.path}}}`}
                                        </div>
                                    </button>
                                ))
                            )}

                            {/* --- Texts i18n Tab --- */}
                            {activeTab === 'texts' && (
                                <div className="space-y-3">
                                    {/* Custom Key Input */}
                                    <div className="p-1">
                                        <label className="text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Clave Personalizada</label>
                                        <div className="flex gap-1">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                                                <input
                                                    type="text"
                                                    value={customTextKey}
                                                    onChange={(e) => setCustomTextKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                                    placeholder="MY_KEY"
                                                    className="w-full pl-6 pr-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-white font-mono uppercase focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none"
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
                                                className="px-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded flex items-center justify-center transition-colors"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="h-px bg-zinc-800 mx-2" />

                                    {/* Common Keys List */}
                                    <div>
                                        <label className="px-2 text-[9px] font-bold text-zinc-600 uppercase mb-1 block">Claves Comunes</label>
                                        {COMMON_TEXT_KEYS.map((t) => (
                                            <button
                                                key={t.key}
                                                type="button"
                                                onClick={() => {
                                                    onSelect(`{{TEXT.${t.key}}}`);
                                                    setIsOpen(false);
                                                }}
                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-900 group transition-all"
                                            >
                                                <div className="text-xs font-medium text-zinc-300 group-hover:text-white">
                                                    {t.description}
                                                </div>
                                                <div className="text-[10px] text-zinc-500 font-mono group-hover:text-purple-400">
                                                    {`{{TEXT.${t.key}}}`}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};