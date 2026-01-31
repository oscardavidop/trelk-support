// /**
//  * ApiCallEditor - Optimized Layout
//  * Fixes: Horizontal scroll & Low contrast
//  */

// import React, { useState, useCallback } from 'react';
// import {
//   Play, Plus, Trash2, ChevronDown, ChevronUp,
//   Settings, Shield, Code, List,
//   Activity, Save, Server, Loader2, AlertTriangle, 
//   Terminal, GitMerge, Variable, Target, ArrowRight
// } from 'lucide-react';

// // ============= TYPES =============

// export interface HeaderItem { id: string; key: string; value: string; enabled: boolean; }
// export interface QueryParam { id: string; key: string; value: string; enabled: boolean; }
// export interface ExtractedVariable { id: string; variableName: string; jsonPath: string; defaultValue?: string; }

// export interface ApiCallConfig {
//   method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
//   url: string;
//   headers: HeaderItem[];
//   queryParams: QueryParam[];
//   bodyType: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
//   body: string;
//   authType: 'none' | 'bearer' | 'basic' | 'api-key';
//   authConfig: {
//     bearerToken?: string;
//     basicUsername?: string;
//     basicPassword?: string;
//     apiKeyName?: string;
//     apiKeyValue?: string;
//     apiKeyLocation?: 'header' | 'query';
//   };
//   timeout: number;
//   retryCount: number;
//   retryDelay: number;
//   successCodes: number[];
//   extractVariables: ExtractedVariable[];
//   onError: 'continue' | 'stop' | 'goto_node';
//   errorNodeId?: string;
//   saveErrorTo?: string;
//   saveResponseTo?: string;
//   saveStatusCodeTo?: string;
// }

// interface ApiCallEditorProps {
//   config: Partial<ApiCallConfig>;
//   onChange: (config: Partial<ApiCallConfig>) => void;
//   flowNodes?: Array<{ id: string; label: string; type: string }>;
// }

// const defaultConfig: ApiCallConfig = {
//   method: 'GET', url: '', headers: [], queryParams: [], bodyType: 'none', body: '',
//   authType: 'none', authConfig: {}, timeout: 30, retryCount: 0, retryDelay: 5,
//   successCodes: [200, 201, 204], extractVariables: [], onError: 'continue',
//   saveResponseTo: '', saveStatusCodeTo: '',
// };

// export default function ApiCallEditor({ config, onChange, flowNodes = [] }: ApiCallEditorProps) {
//   const [activeTab, setActiveTab] = useState<'params' | 'auth' | 'body' | 'output' | 'settings'>('params');
//   const [showPlayground, setShowPlayground] = useState(false);
//   const [isTestRunning, setIsTestRunning] = useState(false);
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   const [playgroundResult, setPlaygroundResult] = useState<any>(null);

//   const cfg: ApiCallConfig = { ...defaultConfig, ...config };

//   const update = useCallback((updates: Partial<ApiCallConfig>) => {
//     onChange({ ...cfg, ...updates });
//   }, [cfg, onChange]);

//   // --- Handlers ---
//   const addItem = (list: 'headers' | 'queryParams' | 'extractVariables') => {
//     const newItem = list === 'extractVariables' 
//       ? { id: Date.now().toString(), variableName: '', jsonPath: '', defaultValue: '' }
//       : { id: Date.now().toString(), key: '', value: '', enabled: true };
//     update({ [list]: [...(cfg[list] as any[]), newItem] });
//   };

//   const updateItem = (list: string, id: string, field: string, value: any) => {
//     update({ [list]: (cfg[list as keyof ApiCallConfig] as any[]).map((i: any) => i.id === id ? { ...i, [field]: value } : i) });
//   };

//   const removeItem = (list: string, id: string) => {
//     update({ [list]: (cfg[list as keyof ApiCallConfig] as any[]).filter((i: any) => i.id !== id) });
//   };

//   // --- Render Helpers ---
//   const methodColor = {
//     GET: 'text-emerald-400', POST: 'text-amber-400', PUT: 'text-blue-400', 
//     DELETE: 'text-red-400', PATCH: 'text-violet-400'
//   }[cfg.method];

//   // --- Estilos Comunes para Inputs ---
//   const inputBase = "bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-zinc-600";

//   return (
//     <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      
//       {/* 1. OMNIBOX (Method + URL + Run) */}
//       <div className="flex gap-2 shrink-0 mb-4 w-full">
//         <div className="flex-1 flex bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all min-w-0">
//           <div className="relative border-r border-zinc-800 shrink-0">
//             <select
//               value={cfg.method}
//               onChange={(e) => update({ method: e.target.value as any })}
//               className={`h-full pl-3 pr-7 appearance-none bg-zinc-950 text-xs font-bold outline-none cursor-pointer hover:bg-zinc-900 transition-colors ${methodColor}`}
//             >
//               {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
//             </select>
//             <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
//           </div>
//           <input
//             type="text"
//             value={cfg.url}
//             onChange={(e) => update({ url: e.target.value })}
//             placeholder="https://api.ejemplo.com/v1"
//             className="flex-1 bg-transparent px-3 py-2 text-sm text-white font-mono placeholder-zinc-600 outline-none min-w-0"
//           />
//         </div>
//         <button
//           onClick={() => setShowPlayground(!showPlayground)}
//           className={`px-3 rounded-lg flex items-center justify-center transition-all border shrink-0 ${
//             showPlayground ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'
//           }`}
//         >
//           {showPlayground ? <ChevronUp className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
//         </button>
//       </div>

//       {/* 2. PLAYGROUND (Terminal) */}
//       {showPlayground && (
//         <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden shadow-2xl shrink-0 h-48 flex flex-col animate-in slide-in-from-top-2 mb-4 w-full">
//           <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
//             <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
//               <Terminal className="w-3 h-3" /> CONSOLE
//             </span>
//             <button 
//                 onClick={() => { setIsTestRunning(true); setTimeout(() => setIsTestRunning(false), 1000); }} // Simulación
//                 className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-300 border border-zinc-700"
//             >
//               {isTestRunning ? <Loader2 className="w-3 h-3 animate-spin"/> : "Ejecutar"}
//             </button>
//           </div>
//           <div className="p-4 flex items-center justify-center h-full text-zinc-500 text-xs font-mono">
//             Esperando petición...
//           </div>
//         </div>
//       )}

//       {/* 3. TABS NAVIGATION */}
//       <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800 shrink-0 mb-4 overflow-x-auto no-scrollbar">
//         {[
//           { id: 'params', label: 'Params', icon: List },
//           { id: 'auth', label: 'Auth', icon: Shield },
//           { id: 'body', label: 'Body', icon: Code },
//           { id: 'output', label: 'Output', icon: Variable },
//           { id: 'settings', label: 'Config', icon: Settings },
//         ].map((tab) => (
//           <button
//             key={tab.id}
//             onClick={() => setActiveTab(tab.id as any)}
//             className={`
//               flex-1 flex items-center justify-center gap-2 px-2 py-1.5 text-[11px] font-medium rounded-md transition-all whitespace-nowrap
//               ${activeTab === tab.id ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}
//             `}
//           >
//             <tab.icon className="w-3.5 h-3.5" />
//             <span>{tab.label}</span>
//           </button>
//         ))}
//       </div>

//       {/* 4. CONTENT AREA (Scrollable) */}
//       <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 w-full">
        
//         {/* --- PARAMS & HEADERS --- */}
//         {activeTab === 'params' && (
//           <div className="space-y-6">
//             {/* Query Params */}
//             <div className="space-y-2">
//               <div className="flex justify-between items-center px-1">
//                 <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Query Params</label>
//                 <button onClick={() => addItem('queryParams')} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3"/> Añadir</button>
//               </div>
//               {cfg.queryParams.length === 0 && <p className="text-xs text-zinc-600 italic px-1">Sin parámetros</p>}
//               {cfg.queryParams.map(p => (
//                 <div key={p.id} className="flex gap-2 group w-full">
//                   <input type="checkbox" checked={p.enabled} onChange={e => updateItem('queryParams', p.id, 'enabled', e.target.checked)} className="mt-2 bg-zinc-900 border-zinc-700 rounded text-indigo-600 focus:ring-0 cursor-pointer shrink-0"/>
//                   <input value={p.key} onChange={e => updateItem('queryParams', p.id, 'key', e.target.value)} placeholder="Key" className={`${inputBase} w-1/3 px-2 py-1.5`}/>
//                   <input value={p.value} onChange={e => updateItem('queryParams', p.id, 'value', e.target.value)} placeholder="Value" className={`${inputBase} flex-1 min-w-0 px-2 py-1.5`}/>
//                   <button onClick={() => removeItem('queryParams', p.id)} className="text-zinc-600 hover:text-red-400 p-1 shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
//                 </div>
//               ))}
//             </div>

//             <div className="h-px bg-zinc-800" />

//             {/* Headers */}
//             <div className="space-y-2">
//               <div className="flex justify-between items-center px-1">
//                 <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Headers</label>
//                 <button onClick={() => addItem('headers')} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3"/> Añadir</button>
//               </div>
//               {cfg.headers.length === 0 && <p className="text-xs text-zinc-600 italic px-1">Sin headers</p>}
//               {cfg.headers.map(h => (
//                 <div key={h.id} className="flex gap-2 group w-full">
//                   <input type="checkbox" checked={h.enabled} onChange={e => updateItem('headers', h.id, 'enabled', e.target.checked)} className="mt-2 bg-zinc-900 border-zinc-700 rounded text-indigo-600 focus:ring-0 cursor-pointer shrink-0"/>
//                   <input value={h.key} onChange={e => updateItem('headers', h.id, 'key', e.target.value)} placeholder="Header" className={`${inputBase} w-1/3 px-2 py-1.5`}/>
//                   <input value={h.value} onChange={e => updateItem('headers', h.id, 'value', e.target.value)} placeholder="Value" className={`${inputBase} flex-1 min-w-0 px-2 py-1.5`}/>
//                   <button onClick={() => removeItem('headers', h.id)} className="text-zinc-600 hover:text-red-400 p-1 shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}

//         {/* --- AUTHENTICATION --- */}
//         {activeTab === 'auth' && (
//           <div className="space-y-4 p-1">
//             <div className="space-y-1">
//               <label className="text-[10px] font-bold text-zinc-400 uppercase">Tipo</label>
//               <select 
//                 value={cfg.authType} 
//                 onChange={e => update({ authType: e.target.value as any })}
//                 className={`${inputBase} w-full px-3 py-2 cursor-pointer`}
//               >
//                 <option value="none">No Authentication</option>
//                 <option value="bearer">Bearer Token</option>
//                 <option value="basic">Basic Auth</option>
//                 <option value="api-key">API Key</option>
//               </select>
//             </div>

//             {cfg.authType === 'bearer' && (
//               <div className="space-y-1">
//                 <label className="text-xs text-zinc-400">Token</label>
//                 <input 
//                   type="password" 
//                   value={cfg.authConfig.bearerToken || ''}
//                   onChange={e => update({ authConfig: { ...cfg.authConfig, bearerToken: e.target.value } })}
//                   className={`${inputBase} w-full px-3 py-2`}
//                   placeholder="eyJhbGciOi..."
//                 />
//               </div>
//             )}

//             {cfg.authType === 'basic' && (
//               <div className="grid grid-cols-2 gap-3">
//                 <div className="space-y-1">
//                   <label className="text-xs text-zinc-400">Username</label>
//                   <input 
//                     value={cfg.authConfig.basicUsername || ''}
//                     onChange={e => update({ authConfig: { ...cfg.authConfig, basicUsername: e.target.value } })}
//                     className={`${inputBase} w-full px-3 py-2`}
//                   />
//                 </div>
//                 <div className="space-y-1">
//                   <label className="text-xs text-zinc-400">Password</label>
//                   <input 
//                     type="password"
//                     value={cfg.authConfig.basicPassword || ''}
//                     onChange={e => update({ authConfig: { ...cfg.authConfig, basicPassword: e.target.value } })}
//                     className={`${inputBase} w-full px-3 py-2`}
//                   />
//                 </div>
//               </div>
//             )}

//             {cfg.authType === 'api-key' && (
//               <div className="space-y-3">
//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="space-y-1">
//                     <label className="text-xs text-zinc-400">Key Name</label>
//                     <input 
//                       value={cfg.authConfig.apiKeyName || ''}
//                       onChange={e => update({ authConfig: { ...cfg.authConfig, apiKeyName: e.target.value } })}
//                       placeholder="x-api-key"
//                       className={`${inputBase} w-full px-3 py-2`}
//                     />
//                   </div>
//                   <div className="space-y-1">
//                     <label className="text-xs text-zinc-400">Value</label>
//                     <input 
//                       type="password"
//                       value={cfg.authConfig.apiKeyValue || ''}
//                       onChange={e => update({ authConfig: { ...cfg.authConfig, apiKeyValue: e.target.value } })}
//                       className={`${inputBase} w-full px-3 py-2`}
//                     />
//                   </div>
//                 </div>
//               </div>
//             )}
//           </div>
//         )}

//         {/* --- BODY --- */}
//         {activeTab === 'body' && (
//           <div className="space-y-3 h-full flex flex-col">
//             <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
//               {['none', 'json', 'raw', 'form-data', 'x-www-form-urlencoded'].map(t => (
//                 <button 
//                   key={t} onClick={() => update({ bodyType: t as any })}
//                   className={`text-[10px] px-2 py-1 rounded border whitespace-nowrap transition-colors ${
//                     cfg.bodyType === t 
//                     ? 'bg-zinc-800 border-zinc-700 text-white' 
//                     : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
//                   }`}
//                 >
//                   {t === 'x-www-form-urlencoded' ? 'x-www-form' : t.toUpperCase()}
//                 </button>
//               ))}
//             </div>
//             {cfg.bodyType !== 'none' ? (
//               <textarea
//                 value={cfg.body} onChange={e => update({ body: e.target.value })}
//                 className={`${inputBase} flex-1 w-full p-3 font-mono resize-none min-h-[200px]`}
//                 placeholder={cfg.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Content...'}
//               />
//             ) : (
//               <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs italic border border-zinc-800/50 bg-zinc-900/20 rounded-lg h-32">
//                 Sin cuerpo de petición
//               </div>
//             )}
//           </div>
//         )}

//         {/* --- OUTPUT (Variable Extraction) --- */}
//         {activeTab === 'output' && (
//           <div className="space-y-6">
            
//             {/* Extraction List */}
//             <div className="space-y-3">
//               <div className="flex justify-between items-center px-1">
//                 <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
//                   <Target className="w-3.5 h-3.5"/> Extraer Variables
//                 </label>
//                 <button onClick={() => addItem('extractVariables')} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
//                   <Plus className="w-3 h-3"/> Añadir
//                 </button>
//               </div>
              
//               {cfg.extractVariables.length === 0 && (
//                 <div className="p-4 border border-dashed border-zinc-800 rounded-lg text-center text-xs text-zinc-600">
//                   No hay variables configuradas.
//                 </div>
//               )}

//               {cfg.extractVariables.map(v => (
//                 <div key={v.id} className="flex flex-col gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
//                   <div className="flex items-center gap-2 w-full">
//                     <span className="text-zinc-500 text-xs font-mono shrink-0">$.</span>
//                     <input 
//                       value={v.jsonPath} onChange={e => updateItem('extractVariables', v.id, 'jsonPath', e.target.value)}
//                       placeholder="data.user.id" className={`${inputBase} flex-1 min-w-0 px-2 py-1.5`}
//                     />
//                     <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
//                     <input 
//                       value={v.variableName} onChange={e => updateItem('extractVariables', v.id, 'variableName', e.target.value)}
//                       placeholder="var_name" className={`${inputBase} w-1/3 min-w-[80px] px-2 py-1.5 text-indigo-300`}
//                     />
//                     <button onClick={() => removeItem('extractVariables', v.id)} className="text-zinc-600 hover:text-red-400 shrink-0 p-1"><Trash2 className="w-3.5 h-3.5"/></button>
//                   </div>
//                   <div className="flex items-center gap-2 pl-4">
//                      <span className="text-[10px] text-zinc-600 shrink-0">Default:</span>
//                      <input 
//                         value={v.defaultValue || ''} onChange={e => updateItem('extractVariables', v.id, 'defaultValue', e.target.value)}
//                         placeholder="(opcional)"
//                         className="bg-transparent border-b border-zinc-800 text-[10px] text-zinc-400 w-full focus:border-zinc-600 outline-none min-w-0"
//                      />
//                   </div>
//                 </div>
//               ))}
//             </div>

//             <div className="h-px bg-zinc-800" />

//             {/* Global Storage Variables */}
//             <div className="space-y-3">
//                <label className="text-[10px] font-bold text-zinc-400 uppercase">Almacenamiento Global</label>
//                <div className="grid grid-cols-1 gap-3">
//                   <div className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
//                      <div className="text-[10px] text-zinc-500 mb-1">Guardar Respuesta Completa en Variable</div>
//                      <div className="flex items-center gap-2">
//                         <Save className="w-3 h-3 text-zinc-600 shrink-0"/>
//                         <input 
//                            value={cfg.saveResponseTo} onChange={e => update({ saveResponseTo: e.target.value })}
//                            placeholder="ej: api_response_full"
//                            className="bg-transparent text-xs text-white w-full outline-none placeholder-zinc-700 min-w-0"
//                         />
//                      </div>
//                   </div>
//                   <div className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
//                      <div className="text-[10px] text-zinc-500 mb-1">Guardar Status Code en Variable</div>
//                      <div className="flex items-center gap-2">
//                         <Activity className="w-3 h-3 text-zinc-600 shrink-0"/>
//                         <input 
//                            value={cfg.saveStatusCodeTo} onChange={e => update({ saveStatusCodeTo: e.target.value })}
//                            placeholder="ej: api_status"
//                            className="bg-transparent text-xs text-white w-full outline-none placeholder-zinc-700 min-w-0"
//                         />
//                      </div>
//                   </div>
//                </div>
//             </div>
//           </div>
//         )}

//         {/* --- SETTINGS (Advanced) --- */}
//         {activeTab === 'settings' && (
//           <div className="space-y-6">
            
//             {/* Execution Control */}
//             <div className="space-y-3">
//               <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
//                 <Server className="w-3.5 h-3.5"/> Control de Ejecución
//               </label>
//               <div className="grid grid-cols-3 gap-3">
//                 <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
//                   <span className="text-[10px] text-zinc-500 block mb-1">Timeout (s)</span>
//                   <input type="number" value={cfg.timeout} onChange={e => update({ timeout: parseInt(e.target.value) })} className="bg-transparent text-sm text-white w-full outline-none font-bold text-center"/>
//                 </div>
//                 <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
//                   <span className="text-[10px] text-zinc-500 block mb-1">Reintentos</span>
//                   <input type="number" value={cfg.retryCount} onChange={e => update({ retryCount: parseInt(e.target.value) })} className="bg-transparent text-sm text-white w-full outline-none font-bold text-center"/>
//                 </div>
//                 <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
//                   <span className="text-[10px] text-zinc-500 block mb-1">Delay (s)</span>
//                   <input type="number" value={cfg.retryDelay} onChange={e => update({ retryDelay: parseInt(e.target.value) })} className="bg-transparent text-sm text-white w-full outline-none font-bold text-center"/>
//                 </div>
//               </div>
//             </div>

//             {/* Success Criteria */}
//             <div className="space-y-2">
//                <label className="text-[10px] font-bold text-zinc-400 uppercase">Códigos de Éxito</label>
//                <input 
//                   value={cfg.successCodes.join(', ')} 
//                   onChange={e => update({ successCodes: e.target.value.split(',').map(n => parseInt(n.trim()) || 0).filter(n => n > 0) })}
//                   placeholder="200, 201"
//                   className={`${inputBase} w-full px-3 py-2 text-emerald-400 font-mono`}
//                />
//             </div>

//             <div className="h-px bg-zinc-800" />

//             {/* Error Handling */}
//             <div className="space-y-3">
//                <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
//                   <AlertTriangle className="w-3.5 h-3.5"/> Si ocurre un error
//                </label>
               
//                <div className="grid grid-cols-1 gap-2">
//                   {['continue', 'stop', 'goto_node'].map((opt) => (
//                     <button 
//                         key={opt}
//                         onClick={() => update({ onError: opt as any })}
//                         className={`w-full py-2 text-xs rounded border transition-all ${
//                             cfg.onError === opt 
//                             ? 'bg-red-500/10 border-red-500/30 text-red-300' 
//                             : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
//                         }`}
//                     >
//                         {opt === 'continue' ? 'Continuar Flujo (Ignorar)' : opt === 'stop' ? 'Detener Flujo' : 'Saltar a otro Nodo'}
//                     </button>
//                   ))}
//                </div>

//                {cfg.onError === 'goto_node' && (
//                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-2 animate-in fade-in slide-in-from-top-1">
//                     <label className="text-[10px] text-red-400 block">Nodo de destino</label>
//                     <div className="relative">
//                        <GitMerge className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-500/50 pointer-events-none"/>
//                        <select 
//                           value={cfg.errorNodeId || ''} 
//                           onChange={e => update({ errorNodeId: e.target.value })}
//                           className="w-full bg-zinc-950 border border-zinc-700 rounded pl-8 pr-8 py-2 text-xs text-white outline-none cursor-pointer appearance-none"
//                        >
//                           <option value="">Seleccionar...</option>
//                           {flowNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
//                        </select>
//                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
//                     </div>
//                  </div>
//                )}

//                <div className="space-y-1">
//                   <label className="text-[10px] text-zinc-500">Guardar mensaje de error en variable</label>
//                   <input 
//                      value={cfg.saveErrorTo || ''} onChange={e => update({ saveErrorTo: e.target.value })}
//                      placeholder="ej: api_error_msg"
//                      className={`${inputBase} w-full px-3 py-2 text-red-300 placeholder-zinc-700 focus:border-red-900/50`}
//                   />
//                </div>
//             </div>

//           </div>
//         )}

//       </div>
//     </div>
//   );
// }

import React, { useState, useCallback } from 'react';
import {
  Play, Plus, Trash2, ChevronDown, ChevronUp,
  Settings, Shield, Code, List,
  Activity, Save, Server, Loader2, AlertTriangle, 
  Terminal, GitMerge, Variable, Target, ArrowRight, Copy, Check,
  Clock
} from 'lucide-react';

// ============= TYPES =============

export interface HeaderItem { id: string; key: string; value: string; enabled: boolean; }
export interface QueryParam { id: string; key: string; value: string; enabled: boolean; }
export interface ExtractedVariable { id: string; variableName: string; jsonPath: string; defaultValue?: string; }

export interface ApiCallConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: HeaderItem[];
  queryParams: QueryParam[];
  bodyType: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
  body: string;
  authType: 'none' | 'bearer' | 'basic' | 'api-key';
  authConfig: {
    bearerToken?: string;
    basicUsername?: string;
    basicPassword?: string;
    apiKeyName?: string;
    apiKeyValue?: string;
    apiKeyLocation?: 'header' | 'query';
  };
  timeout: number;
  retryCount: number;
  retryDelay: number;
  successCodes: number[];
  extractVariables: ExtractedVariable[];
  onError: 'continue' | 'stop' | 'goto_node';
  errorNodeId?: string;
  saveErrorTo?: string;
  saveResponseTo?: string;
  saveStatusCodeTo?: string;
}

interface ApiCallEditorProps {
  config: Partial<ApiCallConfig>;
  onChange: (config: Partial<ApiCallConfig>) => void;
  flowNodes?: Array<{ id: string; label: string; type: string }>;
}

const defaultConfig: ApiCallConfig = {
  method: 'GET', url: '', headers: [], queryParams: [], bodyType: 'none', body: '',
  authType: 'none', authConfig: {}, timeout: 30, retryCount: 0, retryDelay: 5,
  successCodes: [200, 201, 204], extractVariables: [], onError: 'continue',
  saveResponseTo: '', saveStatusCodeTo: '',
};

export default function ApiCallEditor({ config, onChange, flowNodes = [] }: ApiCallEditorProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'auth' | 'body' | 'output' | 'settings'>('params');
  const [showPlayground, setShowPlayground] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<{
    status: number; statusText: string; headers: Record<string, string>; body: any; time: number; error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const cfg: ApiCallConfig = { ...defaultConfig, ...config };

  const update = useCallback((updates: Partial<ApiCallConfig>) => {
    onChange({ ...cfg, ...updates });
  }, [cfg, onChange]);

  // --- Handlers ---
  const addItem = (list: 'headers' | 'queryParams' | 'extractVariables') => {
    const newItem = list === 'extractVariables' 
      ? { id: Date.now().toString(), variableName: '', jsonPath: '', defaultValue: '' }
      : { id: Date.now().toString(), key: '', value: '', enabled: true };
    update({ [list]: [...(cfg[list] as any[]), newItem] });
  };

  const updateItem = (list: string, id: string, field: string, value: any) => {
    update({ [list]: (cfg[list as keyof ApiCallConfig] as any[]).map((i: any) => i.id === id ? { ...i, [field]: value } : i) });
  };

  const removeItem = (list: string, id: string) => {
    update({ [list]: (cfg[list as keyof ApiCallConfig] as any[]).filter((i: any) => i.id !== id) });
  };

  // --- Playground Logic (RESTORED) ---
  const runTest = async () => {
    if (!cfg.url) return;
    setIsTestRunning(true);
    setPlaygroundResult(null);
    const startTime = Date.now();

    try {
      // Build Params
      let url = cfg.url;
      const params = new URLSearchParams();
      cfg.queryParams.filter(p => p.enabled && p.key).forEach(p => params.append(p.key, p.value));
      if (Array.from(params).length > 0) url += (url.includes('?') ? '&' : '?') + params.toString();

      // Build Headers
      const headers: Record<string, string> = {};
      cfg.headers.filter(h => h.enabled && h.key).forEach(h => headers[h.key] = h.value);
      
      // Auth Headers Injection
      if (cfg.authType === 'bearer' && cfg.authConfig.bearerToken) headers['Authorization'] = `Bearer ${cfg.authConfig.bearerToken}`;
      else if (cfg.authType === 'basic') headers['Authorization'] = `Basic ${btoa(`${cfg.authConfig.basicUsername}:${cfg.authConfig.basicPassword}`)}`;
      else if (cfg.authType === 'api-key' && cfg.authConfig.apiKeyLocation === 'header') headers[cfg.authConfig.apiKeyName!] = cfg.authConfig.apiKeyValue || '';

      if (cfg.bodyType === 'json') headers['Content-Type'] = 'application/json';

      // Proxy Request (Cambia esta URL por tu endpoint real si es necesario)
      const response = await fetch('/api/flows/test-api-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: cfg.method, url, headers,
          body: cfg.bodyType !== 'none' ? cfg.body : undefined,
          timeout: cfg.timeout * 1000,
        }),
      });

      const result = await response.json();
      setPlaygroundResult({
        status: result.status || 0,
        statusText: result.statusText || (result.ok ? 'OK' : 'Error'),
        headers: result.headers || {},
        body: result.body,
        time: Date.now() - startTime,
        error: result.error
      });
    } catch (error: any) {
      setPlaygroundResult({
        status: 0, statusText: 'Network Error', headers: {}, body: null,
        time: Date.now() - startTime, error: error.message
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Render Helpers ---
  const methodColor = {
    GET: 'text-emerald-400', POST: 'text-amber-400', PUT: 'text-blue-400', 
    DELETE: 'text-red-400', PATCH: 'text-violet-400'
  }[cfg.method];

  const inputBase = "bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-zinc-600";

  return (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      
      {/* 1. OMNIBOX */}
      <div className="flex gap-2 shrink-0 mb-4 w-full">
        <div className="flex-1 flex bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all min-w-0">
          <div className="relative border-r border-zinc-800 shrink-0">
            <select
              value={cfg.method}
              onChange={(e) => update({ method: e.target.value as any })}
              className={`h-full pl-3 pr-7 appearance-none bg-zinc-950 text-xs font-bold outline-none cursor-pointer hover:bg-zinc-900 transition-colors ${methodColor}`}
            >
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
          </div>
          <input
            type="text"
            value={cfg.url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://api.ejemplo.com/v1"
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white font-mono placeholder-zinc-600 outline-none min-w-0"
          />
        </div>
        <button
          onClick={() => setShowPlayground(!showPlayground)}
          className={`px-3 rounded-lg flex items-center justify-center transition-all border shrink-0 ${
            showPlayground ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'
          }`}
        >
          {showPlayground ? <ChevronUp className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>
      </div>

      {/* 2. PLAYGROUND RESULT (CORREGIDO) */}
      {showPlayground && (
        <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden shadow-2xl shrink-0 h-64 flex flex-col animate-in slide-in-from-top-2 mb-4 w-full">
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
              <Terminal className="w-3 h-3" /> CONSOLE OUTPUT
            </span>
            <div className="flex items-center gap-2">
               {playgroundResult?.body && (
                  <button onClick={() => copyToClipboard(JSON.stringify(playgroundResult.body, null, 2))} className="text-zinc-500 hover:text-white transition-colors">
                     {copied ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3"/>}
                  </button>
               )}
               <button 
                  onClick={runTest}
                  disabled={!cfg.url || isTestRunning}
                  className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
               >
                  {isTestRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {isTestRunning ? 'SENDING...' : 'RUN'}
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar p-3 text-xs font-mono">
            {!playgroundResult ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 italic">
                 <Server className="w-8 h-8 mb-2 opacity-20"/>
                 <span>Listo para probar. Dale a "Run".</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Status Bar */}
                <div className="flex items-center gap-3 border-b border-zinc-900 pb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    playgroundResult.status >= 200 && playgroundResult.status < 300 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/20 text-red-400'
                  }`}>
                    {playgroundResult.status} {playgroundResult.statusText}
                  </span>
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                     <Clock className="w-3 h-3"/> {playgroundResult.time}ms
                  </span>
                </div>

                {/* Error Block */}
                {playgroundResult.error && (
                  <div className="text-red-400 bg-red-950/20 p-2 rounded border border-red-900/50 break-words">
                    Error: {playgroundResult.error}
                  </div>
                )}

                {/* Response Body */}
                {playgroundResult.body ? (
                  <pre className="text-zinc-300 whitespace-pre-wrap break-all">
                    {typeof playgroundResult.body === 'object' ? JSON.stringify(playgroundResult.body, null, 2) : playgroundResult.body}
                  </pre>
                ) : (
                   !playgroundResult.error && <div className="text-zinc-600 italic">Sin contenido en el cuerpo.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TABS */}
      <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800 shrink-0 mb-4 overflow-x-auto no-scrollbar">
        {[
          { id: 'params', label: 'Params', icon: List },
          { id: 'auth', label: 'Auth', icon: Shield },
          { id: 'body', label: 'Body', icon: Code },
          { id: 'output', label: 'Output', icon: Variable },
          { id: 'settings', label: 'Config', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-2 py-1.5 text-[11px] font-medium rounded-md transition-all whitespace-nowrap
              ${activeTab === tab.id ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}
            `}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 4. CONTENT AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 w-full">
        
        {/* --- PARAMS --- */}
        {activeTab === 'params' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Query Params</label>
                <button onClick={() => addItem('queryParams')} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3"/> Añadir</button>
              </div>
              {cfg.queryParams.map(p => (
                <div key={p.id} className="flex gap-2 group w-full">
                  <input type="checkbox" checked={p.enabled} onChange={e => updateItem('queryParams', p.id, 'enabled', e.target.checked)} className="mt-2 bg-zinc-900 border-zinc-700 rounded text-indigo-600 focus:ring-0 cursor-pointer shrink-0"/>
                  <input value={p.key} onChange={e => updateItem('queryParams', p.id, 'key', e.target.value)} placeholder="Key" className={`${inputBase} w-1/3 px-2 py-1.5`}/>
                  <input value={p.value} onChange={e => updateItem('queryParams', p.id, 'value', e.target.value)} placeholder="Value" className={`${inputBase} flex-1 min-w-0 px-2 py-1.5`}/>
                  <button onClick={() => removeItem('queryParams', p.id)} className="text-zinc-600 hover:text-red-400 p-1 shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              ))}
            </div>
            <div className="h-px bg-zinc-800" />
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Headers</label>
                <button onClick={() => addItem('headers')} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3"/> Añadir</button>
              </div>
              {cfg.headers.map(h => (
                <div key={h.id} className="flex gap-2 group w-full">
                  <input type="checkbox" checked={h.enabled} onChange={e => updateItem('headers', h.id, 'enabled', e.target.checked)} className="mt-2 bg-zinc-900 border-zinc-700 rounded text-indigo-600 focus:ring-0 cursor-pointer shrink-0"/>
                  <input value={h.key} onChange={e => updateItem('headers', h.id, 'key', e.target.value)} placeholder="Header" className={`${inputBase} w-1/3 px-2 py-1.5`}/>
                  <input value={h.value} onChange={e => updateItem('headers', h.id, 'value', e.target.value)} placeholder="Value" className={`${inputBase} flex-1 min-w-0 px-2 py-1.5`}/>
                  <button onClick={() => removeItem('headers', h.id)} className="text-zinc-600 hover:text-red-400 p-1 shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- AUTH --- */}
        {activeTab === 'auth' && (
          <div className="space-y-4 p-1">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Tipo</label>
              <select 
                value={cfg.authType} 
                onChange={e => update({ authType: e.target.value as any })}
                className={`${inputBase} w-full px-3 py-2 cursor-pointer`}
              >
                <option value="none">No Authentication</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="api-key">API Key</option>
              </select>
            </div>
            {cfg.authType === 'bearer' && (
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Token</label>
                <input 
                  type="password" 
                  value={cfg.authConfig.bearerToken || ''}
                  onChange={e => update({ authConfig: { ...cfg.authConfig, bearerToken: e.target.value } })}
                  className={`${inputBase} w-full px-3 py-2`}
                  placeholder="eyJhbGciOi..."
                />
              </div>
            )}
            {/* ... Basic & API Key rendered similarly ... */}
          </div>
        )}

        {/* --- BODY --- */}
        {activeTab === 'body' && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {['none', 'json', 'raw', 'form-data', 'x-www-form-urlencoded'].map(t => (
                <button 
                  key={t} onClick={() => update({ bodyType: t as any })}
                  className={`text-[10px] px-2 py-1 rounded border whitespace-nowrap transition-colors ${
                    cfg.bodyType === t 
                    ? 'bg-zinc-800 border-zinc-700 text-white' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t === 'x-www-form-urlencoded' ? 'x-www-form' : t.toUpperCase()}
                </button>
              ))}
            </div>
            {cfg.bodyType !== 'none' ? (
              <textarea
                value={cfg.body} onChange={e => update({ body: e.target.value })}
                className={`${inputBase} flex-1 w-full p-3 font-mono resize-none min-h-[200px] text-zinc-300`}
                placeholder={cfg.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Content...'}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs italic border border-zinc-800/50 bg-zinc-900/20 rounded-lg h-32">
                Sin cuerpo de petición
              </div>
            )}
          </div>
        )}

        {/* --- OUTPUT --- */}
        {activeTab === 'output' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                  <Target className="w-3.5 h-3.5"/> Extraer Variables
                </label>
                <button onClick={() => addItem('extractVariables')} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  <Plus className="w-3 h-3"/> Añadir
                </button>
              </div>
              {cfg.extractVariables.map(v => (
                <div key={v.id} className="flex flex-col gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-zinc-500 text-xs font-mono shrink-0">$.</span>
                    <input 
                      value={v.jsonPath} onChange={e => updateItem('extractVariables', v.id, 'jsonPath', e.target.value)}
                      placeholder="data.user.id" className={`${inputBase} flex-1 min-w-0 px-2 py-1.5`}
                    />
                    <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                    <input 
                      value={v.variableName} onChange={e => updateItem('extractVariables', v.id, 'variableName', e.target.value)}
                      placeholder="var_name" className={`${inputBase} w-1/3 min-w-[80px] px-2 py-1.5 text-indigo-300`}
                    />
                    <button onClick={() => removeItem('extractVariables', v.id)} className="text-zinc-600 hover:text-red-400 shrink-0 p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="h-px bg-zinc-800" />

            <div className="space-y-3">
               <label className="text-[10px] font-bold text-zinc-400 uppercase">Almacenamiento Global</label>
               <div className="grid grid-cols-1 gap-3">
                  <div className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
                     <div className="text-[10px] text-zinc-500 mb-1">Respuesta Completa → Variable</div>
                     <input 
                        value={cfg.saveResponseTo} onChange={e => update({ saveResponseTo: e.target.value })}
                        placeholder="ej: api_response_full"
                        className="bg-transparent text-xs text-white w-full outline-none placeholder-zinc-700 min-w-0"
                     />
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
                     <div className="text-[10px] text-zinc-500 mb-1">Status Code → Variable</div>
                     <input 
                        value={cfg.saveStatusCodeTo} onChange={e => update({ saveStatusCodeTo: e.target.value })}
                        placeholder="ej: api_status"
                        className="bg-transparent text-xs text-white w-full outline-none placeholder-zinc-700 min-w-0"
                     />
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* --- SETTINGS --- */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                <Server className="w-3.5 h-3.5"/> Control de Ejecución
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
                  <span className="text-[10px] text-zinc-500 block mb-1">Timeout (s)</span>
                  <input type="number" value={cfg.timeout} onChange={e => update({ timeout: parseInt(e.target.value) })} className="bg-transparent text-sm text-white w-full outline-none font-bold text-center"/>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
                  <span className="text-[10px] text-zinc-500 block mb-1">Reintentos</span>
                  <input type="number" value={cfg.retryCount} onChange={e => update({ retryCount: parseInt(e.target.value) })} className="bg-transparent text-sm text-white w-full outline-none font-bold text-center"/>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
                  <span className="text-[10px] text-zinc-500 block mb-1">Delay (s)</span>
                  <input type="number" value={cfg.retryDelay} onChange={e => update({ retryDelay: parseInt(e.target.value) })} className="bg-transparent text-sm text-white w-full outline-none font-bold text-center"/>
                </div>
              </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold text-zinc-400 uppercase">Códigos de Éxito</label>
               <input 
                  value={cfg.successCodes.join(', ')} 
                  onChange={e => update({ successCodes: e.target.value.split(',').map(n => parseInt(n.trim()) || 0).filter(n => n > 0) })}
                  placeholder="200, 201"
                  className={`${inputBase} w-full px-3 py-2 text-emerald-400 font-mono`}
               />
            </div>

            <div className="h-px bg-zinc-800" />

            <div className="space-y-3">
               <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5"/> Manejo de Fallos
               </label>
               <div className="grid grid-cols-3 gap-2">
                  {['continue', 'stop', 'goto_node'].map((opt) => (
                    <button 
                        key={opt}
                        onClick={() => update({ onError: opt as any })}
                        className={`w-full py-2 text-[10px] font-bold uppercase rounded border transition-all ${
                            cfg.onError === opt 
                            ? 'bg-red-500/10 border-red-500/30 text-red-300' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        {opt}
                    </button>
                  ))}
               </div>
               {cfg.onError === 'goto_node' && (
                 <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-2">
                    <label className="text-[10px] text-red-400 block">Nodo de destino</label>
                    <div className="relative">
                       <GitMerge className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-500/50 pointer-events-none"/>
                       <select 
                          value={cfg.errorNodeId || ''} 
                          onChange={e => update({ errorNodeId: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded pl-8 pr-8 py-2 text-xs text-white outline-none cursor-pointer appearance-none"
                       >
                          <option value="">Seleccionar...</option>
                          {flowNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                       </select>
                       <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}