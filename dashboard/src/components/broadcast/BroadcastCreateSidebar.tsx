// /**
//  * BroadcastCreateSidebar - Advanced sidebar for creating broadcasts
//  * Supports multiple message types: text, photo, video, document, audio, poll
//  * Reuses FileUpload component from flows
//  */

// import React, { useState, useCallback, useEffect, useRef } from 'react';
// import { useAuthStore } from '../../stores/authStore';
// import {
//   X,
//   Send,
//   Users,
//   Target,
//   Image,
//   Video,
//   FileText,
//   Music,
//   BarChart3,
//   Type,
//   Plus,
//   Trash2,
//   ChevronDown,
//   ChevronRight,
//   Settings,
//   Clock,
//   Loader2,
//   AlertCircle,
//   Info,
//   Sparkles,
//   Bold,
//   Italic,
//   Code,
//   Link,
//   Strikethrough,
// } from 'lucide-react';
// import { FileUpload, type MediaType } from '../flows/FileUpload';

// // ============= TYPES =============

// export type BroadcastMessageType = 'text' | 'photo' | 'video' | 'document' | 'audio' | 'poll';

// interface Segment {
//   _id: string;
//   name: string;
//   color: string;
//   contactCount: number;
//   isActive: boolean;
// }

// interface PollOption {
//   text: string;
// }

// interface BroadcastFormData {
//   title: string;
//   messageType: BroadcastMessageType;
//   // Text content
//   text: string;
//   parseMode: '' | 'HTML' | 'Markdown' | 'MarkdownV2';
//   // Media
//   mediaUrl: string;
//   caption: string;
//   // Poll
//   pollQuestion: string;
//   pollOptions: PollOption[];
//   pollIsAnonymous: boolean;
//   pollAllowsMultiple: boolean;
//   // Target
//   targetType: 'all' | 'segment';
//   segmentId: string;
//   // Advanced
//   batchSize: number;
//   batchDelayMs: number;
//   // Scheduling
//   scheduleEnabled: boolean;
//   scheduledAt: string;
// }

// interface BroadcastCreateSidebarProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onCreated: () => void;
//   segments: Segment[];
// }

// // ============= MESSAGE TYPE CONFIG =============

// const MESSAGE_TYPES: { type: BroadcastMessageType; label: string; icon: React.ReactNode; description: string }[] = [
//   { type: 'text', label: 'Texto', icon: <Type className="w-5 h-5" />, description: 'Mensaje de texto simple o con formato' },
//   { type: 'photo', label: 'Foto', icon: <Image className="w-5 h-5" />, description: 'Imagen con caption opcional' },
//   { type: 'video', label: 'Video', icon: <Video className="w-5 h-5" />, description: 'Video con caption opcional' },
//   { type: 'document', label: 'Documento', icon: <FileText className="w-5 h-5" />, description: 'Archivo PDF, DOC, etc.' },
//   { type: 'audio', label: 'Audio', icon: <Music className="w-5 h-5" />, description: 'Archivo de audio' },
//   { type: 'poll', label: 'Encuesta', icon: <BarChart3 className="w-5 h-5" />, description: 'Encuesta con opciones' },
// ];

// // ============= VARIABLES =============

// const AVAILABLE_VARIABLES = [
//   { path: 'user.firstName', label: 'Nombre', description: 'Nombre del usuario' },
//   { path: 'user.lastName', label: 'Apellido', description: 'Apellido del usuario' },
//   { path: 'user.username', label: 'Username', description: '@username de Telegram' },
//   { path: 'date', label: 'Fecha', description: 'Fecha actual' },
//   { path: 'time', label: 'Hora', description: 'Hora actual' },
// ];

// // ============= COMPONENT =============

// export function BroadcastCreateSidebar({ isOpen, onClose, onCreated, segments }: BroadcastCreateSidebarProps) {
//   const { token } = useAuthStore();
//   const textareaRef = useRef<HTMLTextAreaElement>(null);
  
//   // Form state
//   const [formData, setFormData] = useState<BroadcastFormData>({
//     title: '',
//     messageType: 'text',
//     text: '',
//     parseMode: '',
//     mediaUrl: '',
//     caption: '',
//     pollQuestion: '',
//     pollOptions: [{ text: '' }, { text: '' }],
//     pollIsAnonymous: true,
//     pollAllowsMultiple: false,
//     targetType: 'all',
//     segmentId: '',
//     batchSize: 25,
//     batchDelayMs: 1000,
//     scheduleEnabled: false,
//     scheduledAt: '',
//   });
  
//   const [showAdvanced, setShowAdvanced] = useState(false);
//   const [showVariables, setShowVariables] = useState(false);
//   const [creating, setCreating] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [activeTextField, setActiveTextField] = useState<'text' | 'caption' | 'poll'>('text');

//   // Reset form when closed
//   useEffect(() => {
//     if (!isOpen) {
//       setFormData({
//         title: '',
//         messageType: 'text',
//         text: '',
//         parseMode: '',
//         mediaUrl: '',
//         caption: '',
//         pollQuestion: '',
//         pollOptions: [{ text: '' }, { text: '' }],
//         pollIsAnonymous: true,
//         pollAllowsMultiple: false,
//         targetType: 'all',
//         segmentId: '',
//         batchSize: 25,
//         batchDelayMs: 1000,
//         scheduleEnabled: false,
//         scheduledAt: '',
//       });
//       setShowAdvanced(false);
//       setError(null);
//     }
//   }, [isOpen]);

//   // Update field
//   const updateField = <K extends keyof BroadcastFormData>(key: K, value: BroadcastFormData[K]) => {
//     setFormData(prev => ({ ...prev, [key]: value }));
//   };

//   // Insert variable at cursor
//   const insertVariable = (variable: string) => {
//     const insertion = `{{${variable}}}`;
    
//     if (activeTextField === 'text' || activeTextField === 'caption') {
//       const field = activeTextField === 'text' ? 'text' : 'caption';
//       const currentValue = formData[field];
//       updateField(field, currentValue + insertion);
//     }
//     setShowVariables(false);
//   };

//   // Insert formatting
//   const insertFormatting = (type: 'bold' | 'italic' | 'code' | 'link' | 'strike') => {
//     const field = activeTextField === 'text' ? 'text' : 'caption';
//     const currentValue = formData[field];
    
//     let insertion = '';
//     switch (type) {
//       case 'bold':
//         insertion = formData.parseMode === 'HTML' ? '<b>texto</b>' : '*texto*';
//         break;
//       case 'italic':
//         insertion = formData.parseMode === 'HTML' ? '<i>texto</i>' : '_texto_';
//         break;
//       case 'code':
//         insertion = formData.parseMode === 'HTML' ? '<code>código</code>' : '`código`';
//         break;
//       case 'link':
//         insertion = formData.parseMode === 'HTML' ? '<a href="url">texto</a>' : '[texto](url)';
//         break;
//       case 'strike':
//         insertion = formData.parseMode === 'HTML' ? '<s>texto</s>' : '~texto~';
//         break;
//     }
    
//     updateField(field as 'text' | 'caption', currentValue + insertion);
//   };

//   // Poll options
//   const addPollOption = () => {
//     if (formData.pollOptions.length < 10) {
//       updateField('pollOptions', [...formData.pollOptions, { text: '' }]);
//     }
//   };

//   const removePollOption = (index: number) => {
//     if (formData.pollOptions.length > 2) {
//       updateField('pollOptions', formData.pollOptions.filter((_, i) => i !== index));
//     }
//   };

//   const updatePollOption = (index: number, text: string) => {
//     const newOptions = [...formData.pollOptions];
//     newOptions[index] = { text };
//     updateField('pollOptions', newOptions);
//   };

//   // Validation
//   const isValid = useCallback(() => {
//     if (!formData.title.trim()) return false;
    
//     switch (formData.messageType) {
//       case 'text':
//         return formData.text.trim().length > 0;
//       case 'photo':
//       case 'video':
//       case 'document':
//       case 'audio':
//         return formData.mediaUrl.trim().length > 0;
//       case 'poll':
//         return (
//           formData.pollQuestion.trim().length > 0 &&
//           formData.pollOptions.filter(o => o.text.trim()).length >= 2
//         );
//       default:
//         return false;
//     }
//   }, [formData]);

//   // Create broadcast
//   const handleCreate = async () => {
//     if (!isValid()) return;
    
//     setCreating(true);
//     setError(null);
    
//     try {
//       const payload: any = {
//         title: formData.title.trim(),
//         messageType: formData.messageType,
//         targetType: formData.targetType,
//         segmentId: formData.targetType === 'segment' ? formData.segmentId : undefined,
//         batchSize: formData.batchSize,
//         batchDelayMs: formData.batchDelayMs,
//       };

//       // Add type-specific fields
//       switch (formData.messageType) {
//         case 'text':
//           payload.message = formData.text.trim();
//           payload.parseMode = formData.parseMode || undefined;
//           break;
//         case 'photo':
//         case 'video':
//         case 'document':
//         case 'audio':
//           payload.mediaUrl = formData.mediaUrl;
//           payload.caption = formData.caption.trim() || undefined;
//           payload.parseMode = formData.parseMode || undefined;
//           break;
//         case 'poll':
//           payload.pollQuestion = formData.pollQuestion.trim();
//           payload.pollOptions = formData.pollOptions.filter(o => o.text.trim()).map(o => o.text.trim());
//           payload.pollIsAnonymous = formData.pollIsAnonymous;
//           payload.pollAllowsMultiple = formData.pollAllowsMultiple;
//           break;
//       }

//       // Scheduling
//       if (formData.scheduleEnabled && formData.scheduledAt) {
//         payload.scheduledAt = new Date(formData.scheduledAt).toISOString();
//       }

//       const res = await fetch('/api/broadcast', {
//         method: 'POST',
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(payload),
//       });

//       const data = await res.json();

//       if (res.ok && data.success) {
//         onCreated();
//         onClose();
//       } else {
//         setError(data.error || 'Error al crear el broadcast');
//       }
//     } catch (err: any) {
//       setError(err.message || 'Error de conexión');
//     } finally {
//       setCreating(false);
//     }
//   };

//   // Get media type for FileUpload
//   const getMediaType = (): MediaType => {
//     switch (formData.messageType) {
//       case 'photo': return 'image';
//       case 'video': return 'video';
//       case 'audio': return 'audio';
//       case 'document': return 'document';
//       default: return 'document';
//     }
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
//       {/* Header */}
//       <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
//         <div className="flex items-center gap-3">
//           <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl">
//             <Send className="w-5 h-5 text-violet-400" />
//           </div>
//           <div>
//             <h2 className="text-lg font-semibold text-white">Nuevo Broadcast</h2>
//             <p className="text-xs text-gray-500">Mensaje masivo a usuarios</p>
//           </div>
//         </div>
//         <button
//           onClick={onClose}
//           className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
//         >
//           <X className="w-5 h-5" />
//         </button>
//       </div>

//       {/* Content */}
//       <div className="flex-1 overflow-auto p-6 space-y-6">
//         {/* Error */}
//         {error && (
//           <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
//             <AlertCircle className="w-4 h-4 flex-shrink-0" />
//             {error}
//           </div>
//         )}

//         {/* Title */}
//         <div>
//           <label className="block text-sm font-medium text-gray-300 mb-2">
//             Título <span className="text-gray-500">(solo interno)</span>
//           </label>
//           <input
//             type="text"
//             value={formData.title}
//             onChange={(e) => updateField('title', e.target.value)}
//             placeholder="Ej: Promoción Enero 2025"
//             className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
//           />
//         </div>

//         {/* Message Type Selector */}
//         <div>
//           <label className="block text-sm font-medium text-gray-300 mb-3">
//             Tipo de mensaje
//           </label>
//           <div className="grid grid-cols-3 gap-2">
//             {MESSAGE_TYPES.map(({ type, label, icon, description }) => (
//               <button
//                 key={type}
//                 onClick={() => updateField('messageType', type)}
//                 className={`p-3 rounded-xl border text-left transition-all ${
//                   formData.messageType === type
//                     ? 'border-violet-500 bg-violet-500/10'
//                     : 'border-gray-700 bg-gray-900 hover:border-gray-600'
//                 }`}
//               >
//                 <div className={`mb-2 ${formData.messageType === type ? 'text-violet-400' : 'text-gray-400'}`}>
//                   {icon}
//                 </div>
//                 <div className={`text-sm font-medium ${formData.messageType === type ? 'text-white' : 'text-gray-300'}`}>
//                   {label}
//                 </div>
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Text Message Content */}
//         {formData.messageType === 'text' && (
//           <div className="space-y-3">
//             {/* Toolbar */}
//             <div className="flex items-center gap-1 flex-wrap">
//               <select
//                 value={formData.parseMode}
//                 onChange={(e) => updateField('parseMode', e.target.value as any)}
//                 className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs"
//               >
//                 <option value="">Texto plano</option>
//                 <option value="HTML">HTML</option>
//                 <option value="Markdown">Markdown</option>
//                 <option value="MarkdownV2">MarkdownV2</option>
//               </select>
              
//               {formData.parseMode && (
//                 <>
//                   <div className="w-px h-5 bg-gray-700 mx-1" />
//                   <button onClick={() => insertFormatting('bold')} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Negrita">
//                     <Bold className="w-4 h-4" />
//                   </button>
//                   <button onClick={() => insertFormatting('italic')} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Cursiva">
//                     <Italic className="w-4 h-4" />
//                   </button>
//                   <button onClick={() => insertFormatting('strike')} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Tachado">
//                     <Strikethrough className="w-4 h-4" />
//                   </button>
//                   <button onClick={() => insertFormatting('code')} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Código">
//                     <Code className="w-4 h-4" />
//                   </button>
//                   <button onClick={() => insertFormatting('link')} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Enlace">
//                     <Link className="w-4 h-4" />
//                   </button>
//                 </>
//               )}
              
//               <div className="w-px h-5 bg-gray-700 mx-1" />
              
//               <div className="relative">
//                 <button
//                   onClick={() => { setActiveTextField('text'); setShowVariables(!showVariables); }}
//                   className="flex items-center gap-1 px-2 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-xs"
//                 >
//                   <Sparkles className="w-3 h-3" />
//                   Variables
//                 </button>
                
//                 {showVariables && activeTextField === 'text' && (
//                   <div className="absolute top-full left-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 p-2">
//                     {AVAILABLE_VARIABLES.map(v => (
//                       <button
//                         key={v.path}
//                         onClick={() => insertVariable(v.path)}
//                         className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
//                       >
//                         <div className="text-sm text-white">{v.label}</div>
//                         <div className="text-xs text-gray-500 font-mono">{`{{${v.path}}}`}</div>
//                       </button>
//                     ))}
//                   </div>
//                 )}
//               </div>
//             </div>
            
//             {/* Textarea */}
//             <div>
//               <textarea
//                 ref={textareaRef}
//                 value={formData.text}
//                 onChange={(e) => updateField('text', e.target.value.slice(0, 4096))}
//                 onFocus={() => setActiveTextField('text')}
//                 placeholder="Escribe tu mensaje aquí..."
//                 rows={8}
//                 className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-none font-mono text-sm"
//               />
//               <div className="flex justify-end mt-1">
//                 <span className="text-xs text-gray-500">{formData.text.length}/4096</span>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Media Content (Photo, Video, Document, Audio) */}
//         {['photo', 'video', 'document', 'audio'].includes(formData.messageType) && (
//           <div className="space-y-4">
//             {/* File Upload */}
//             <div>
//               <label className="block text-sm font-medium text-gray-300 mb-2">
//                 {formData.messageType === 'photo' && 'Imagen'}
//                 {formData.messageType === 'video' && 'Video'}
//                 {formData.messageType === 'document' && 'Documento'}
//                 {formData.messageType === 'audio' && 'Audio'}
//               </label>
//               <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
//                 <FileUpload
//                   mediaType={getMediaType()}
//                   value={formData.mediaUrl}
//                   onChange={(url) => updateField('mediaUrl', url)}
//                 />
//               </div>
//             </div>

//             {/* Caption (except audio) */}
//             {formData.messageType !== 'audio' && (
//               <div className="space-y-2">
//                 <div className="flex items-center justify-between">
//                   <label className="text-sm font-medium text-gray-300">
//                     Caption <span className="text-gray-500">(opcional)</span>
//                   </label>
//                   <div className="flex items-center gap-2">
//                     <select
//                       value={formData.parseMode}
//                       onChange={(e) => updateField('parseMode', e.target.value as any)}
//                       className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs"
//                     >
//                       <option value="">Texto plano</option>
//                       <option value="HTML">HTML</option>
//                       <option value="Markdown">Markdown</option>
//                     </select>
//                     <button
//                       onClick={() => { setActiveTextField('caption'); setShowVariables(!showVariables); }}
//                       className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-xs"
//                     >
//                       <Sparkles className="w-3 h-3" />
//                     </button>
//                   </div>
//                 </div>
//                 <textarea
//                   value={formData.caption}
//                   onChange={(e) => updateField('caption', e.target.value.slice(0, 1024))}
//                   onFocus={() => setActiveTextField('caption')}
//                   placeholder="Añade un caption..."
//                   rows={3}
//                   className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-none text-sm"
//                 />
//                 <div className="flex justify-end">
//                   <span className="text-xs text-gray-500">{formData.caption.length}/1024</span>
//                 </div>
//               </div>
//             )}
//           </div>
//         )}

//         {/* Poll Content */}
//         {formData.messageType === 'poll' && (
//           <div className="space-y-4">
//             {/* Question */}
//             <div>
//               <label className="block text-sm font-medium text-gray-300 mb-2">
//                 Pregunta de la encuesta
//               </label>
//               <input
//                 type="text"
//                 value={formData.pollQuestion}
//                 onChange={(e) => updateField('pollQuestion', e.target.value.slice(0, 300))}
//                 placeholder="¿Cuál es tu opción favorita?"
//                 className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
//               />
//               <div className="flex justify-end mt-1">
//                 <span className="text-xs text-gray-500">{formData.pollQuestion.length}/300</span>
//               </div>
//             </div>

//             {/* Options */}
//             <div>
//               <label className="block text-sm font-medium text-gray-300 mb-2">
//                 Opciones <span className="text-gray-500">(mín. 2, máx. 10)</span>
//               </label>
//               <div className="space-y-2">
//                 {formData.pollOptions.map((option, index) => (
//                   <div key={index} className="flex items-center gap-2">
//                     <span className="w-6 text-center text-gray-500 text-sm">{index + 1}.</span>
//                     <input
//                       type="text"
//                       value={option.text}
//                       onChange={(e) => updatePollOption(index, e.target.value.slice(0, 100))}
//                       placeholder={`Opción ${index + 1}`}
//                       className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-violet-500 outline-none text-sm"
//                     />
//                     {formData.pollOptions.length > 2 && (
//                       <button
//                         onClick={() => removePollOption(index)}
//                         className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
//                       >
//                         <Trash2 className="w-4 h-4" />
//                       </button>
//                     )}
//                   </div>
//                 ))}
                
//                 {formData.pollOptions.length < 10 && (
//                   <button
//                     onClick={addPollOption}
//                     className="flex items-center gap-2 w-full px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 border border-dashed border-gray-700 rounded-lg transition-colors text-sm"
//                   >
//                     <Plus className="w-4 h-4" />
//                     Añadir opción
//                   </button>
//                 )}
//               </div>
//             </div>

//             {/* Poll settings */}
//             <div className="grid grid-cols-2 gap-4 p-4 bg-gray-900/50 rounded-xl">
//               <label className="flex items-center gap-3 cursor-pointer">
//                 <input
//                   type="checkbox"
//                   checked={formData.pollIsAnonymous}
//                   onChange={(e) => updateField('pollIsAnonymous', e.target.checked)}
//                   className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
//                 />
//                 <span className="text-sm text-gray-300">Encuesta anónima</span>
//               </label>
//               <label className="flex items-center gap-3 cursor-pointer">
//                 <input
//                   type="checkbox"
//                   checked={formData.pollAllowsMultiple}
//                   onChange={(e) => updateField('pollAllowsMultiple', e.target.checked)}
//                   className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
//                 />
//                 <span className="text-sm text-gray-300">Múltiples respuestas</span>
//               </label>
//             </div>
//           </div>
//         )}

//         {/* Target */}
//         <div>
//           <label className="block text-sm font-medium text-gray-300 mb-3">
//             Destinatarios
//           </label>
//           <div className="grid grid-cols-2 gap-3">
//             <button
//               onClick={() => updateField('targetType', 'all')}
//               className={`p-4 rounded-xl border text-left transition-all ${
//                 formData.targetType === 'all'
//                   ? 'border-violet-500 bg-violet-500/10'
//                   : 'border-gray-700 bg-gray-900 hover:border-gray-600'
//               }`}
//             >
//               <Users className={`w-5 h-5 mb-2 ${formData.targetType === 'all' ? 'text-violet-400' : 'text-gray-400'}`} />
//               <div className={`text-sm font-medium ${formData.targetType === 'all' ? 'text-white' : 'text-gray-300'}`}>
//                 Todos los usuarios
//               </div>
//               <div className="text-xs text-gray-500 mt-1">Toda la base de datos</div>
//             </button>
//             <button
//               onClick={() => updateField('targetType', 'segment')}
//               className={`p-4 rounded-xl border text-left transition-all ${
//                 formData.targetType === 'segment'
//                   ? 'border-violet-500 bg-violet-500/10'
//                   : 'border-gray-700 bg-gray-900 hover:border-gray-600'
//               }`}
//             >
//               <Target className={`w-5 h-5 mb-2 ${formData.targetType === 'segment' ? 'text-violet-400' : 'text-gray-400'}`} />
//               <div className={`text-sm font-medium ${formData.targetType === 'segment' ? 'text-white' : 'text-gray-300'}`}>
//                 Segmento
//               </div>
//               <div className="text-xs text-gray-500 mt-1">Usuarios filtrados</div>
//             </button>
//           </div>
          
//           {formData.targetType === 'segment' && (
//             <div className="mt-3">
//               <select
//                 value={formData.segmentId}
//                 onChange={(e) => updateField('segmentId', e.target.value)}
//                 className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-violet-500 outline-none"
//               >
//                 <option value="">Selecciona un segmento...</option>
//                 {segments.filter(s => s.isActive).map(seg => (
//                   <option key={seg._id} value={seg._id}>
//                     {seg.name} ({seg.contactCount.toLocaleString()} contactos)
//                   </option>
//                 ))}
//               </select>
//             </div>
//           )}
//         </div>

//         {/* Advanced Options */}
//         <div className="border border-gray-800 rounded-xl overflow-hidden">
//           <button
//             onClick={() => setShowAdvanced(!showAdvanced)}
//             className="w-full flex items-center justify-between p-4 hover:bg-gray-900/50 transition-colors"
//           >
//             <div className="flex items-center gap-2 text-gray-300">
//               <Settings className="w-4 h-4 text-gray-500" />
//               <span className="text-sm font-medium">Opciones avanzadas</span>
//             </div>
//             {showAdvanced ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
//           </button>
          
//           {showAdvanced && (
//             <div className="p-4 border-t border-gray-800 space-y-4">
//               {/* Batch settings */}
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-xs text-gray-400 mb-1">Mensajes por lote</label>
//                   <input
//                     type="number"
//                     value={formData.batchSize}
//                     onChange={(e) => updateField('batchSize', Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
//                     min={1}
//                     max={30}
//                     className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
//                   />
//                   <p className="text-[10px] text-gray-500 mt-1">Máx: 30 (límite Telegram)</p>
//                 </div>
//                 <div>
//                   <label className="block text-xs text-gray-400 mb-1">Delay entre lotes (ms)</label>
//                   <input
//                     type="number"
//                     value={formData.batchDelayMs}
//                     onChange={(e) => updateField('batchDelayMs', Math.min(5000, Math.max(100, parseInt(e.target.value) || 1000)))}
//                     min={100}
//                     max={5000}
//                     step={100}
//                     className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
//                   />
//                   <p className="text-[10px] text-gray-500 mt-1">100-5000ms recomendado</p>
//                 </div>
//               </div>

//               {/* Schedule */}
//               <div className="pt-4 border-t border-gray-800">
//                 <label className="flex items-center gap-3 cursor-pointer mb-3">
//                   <input
//                     type="checkbox"
//                     checked={formData.scheduleEnabled}
//                     onChange={(e) => updateField('scheduleEnabled', e.target.checked)}
//                     className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
//                   />
//                   <div className="flex items-center gap-2 text-sm text-gray-300">
//                     <Clock className="w-4 h-4 text-gray-500" />
//                     Programar envío
//                   </div>
//                 </label>
                
//                 {formData.scheduleEnabled && (
//                   <input
//                     type="datetime-local"
//                     value={formData.scheduledAt}
//                     onChange={(e) => updateField('scheduledAt', e.target.value)}
//                     min={new Date().toISOString().slice(0, 16)}
//                     className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
//                   />
//                 )}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Info */}
//         <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs">
//           <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
//           <div>
//             <p>El broadcast se creará en estado "pendiente". Deberás confirmarlo para iniciar el envío.</p>
//             <p className="mt-1 text-blue-400/70">Usa variables como {'{{user.firstName}}'} para personalizar mensajes.</p>
//           </div>
//         </div>
//       </div>

//       {/* Footer */}
//       <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-gray-950">
//         <button
//           onClick={onClose}
//           className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
//         >
//           Cancelar
//         </button>
//         <button
//           onClick={handleCreate}
//           disabled={creating || !isValid() || (formData.targetType === 'segment' && !formData.segmentId)}
//           className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all shadow-lg shadow-violet-500/25"
//         >
//           {creating ? (
//             <Loader2 className="w-4 h-4 animate-spin" />
//           ) : (
//             <Send className="w-4 h-4" />
//           )}
//           Crear Broadcast
//         </button>
//       </div>
//     </div>
//   );
// }

// export default BroadcastCreateSidebar;

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import {
  X, Send, Users, Target, Image, Video, FileText, Music, BarChart3,
  Type, Plus, Trash2, ChevronDown, ChevronRight, Settings, Clock,
  Loader2, AlertCircle, Info, Sparkles, Bold, Italic, Code, Link,
  Strikethrough, Calendar, CheckCircle2, ChevronUp
} from 'lucide-react';
import { FileUpload, type MediaType } from '../flows/FileUpload';

// ============= TYPES (Mismos tipos originales) =============

export type BroadcastMessageType = 'text' | 'photo' | 'video' | 'document' | 'audio' | 'poll';

interface Segment { _id: string; name: string; color: string; contactCount: number; isActive: boolean; }
interface PollOption { text: string; }
interface BroadcastFormData {
  title: string;
  messageType: BroadcastMessageType;
  text: string;
  parseMode: '' | 'HTML' | 'Markdown' | 'MarkdownV2';
  mediaUrl: string;
  caption: string;
  pollQuestion: string;
  pollOptions: PollOption[];
  pollIsAnonymous: boolean;
  pollAllowsMultiple: boolean;
  targetType: 'all' | 'segment';
  segmentId: string;
  batchSize: number;
  batchDelayMs: number;
  scheduleEnabled: boolean;
  scheduledAt: string;
}

interface BroadcastCreateSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  segments: Segment[];
}

// ============= CONFIG =============

const MESSAGE_TYPES: { type: BroadcastMessageType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: 'text', label: 'Texto', icon: <Type className="w-5 h-5" />, description: 'Mensaje simple' },
  { type: 'photo', label: 'Imagen', icon: <Image className="w-5 h-5" />, description: 'Foto + caption' },
  { type: 'video', label: 'Video', icon: <Video className="w-5 h-5" />, description: 'Video + caption' },
  { type: 'document', label: 'Archivo', icon: <FileText className="w-5 h-5" />, description: 'PDF, Doc, Zip' },
  { type: 'audio', label: 'Audio', icon: <Music className="w-5 h-5" />, description: 'MP3, Voz' },
  { type: 'poll', label: 'Encuesta', icon: <BarChart3 className="w-5 h-5" />, description: 'Votación' },
];

const AVAILABLE_VARIABLES = [
  { path: 'user.firstName', label: 'Nombre' },
  { path: 'user.lastName', label: 'Apellido' },
  { path: 'user.username', label: 'Username' },
  { path: 'date', label: 'Fecha' },
];

// ============= COMPONENT =============

export function BroadcastCreateSidebar({ isOpen, onClose, onCreated, segments }: BroadcastCreateSidebarProps) {
  const { token } = useAuthStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Form state
  const [formData, setFormData] = useState<BroadcastFormData>({
    title: '',
    messageType: 'text',
    text: '',
    parseMode: '',
    mediaUrl: '',
    caption: '',
    pollQuestion: '',
    pollOptions: [{ text: '' }, { text: '' }],
    pollIsAnonymous: true,
    pollAllowsMultiple: false,
    targetType: 'all',
    segmentId: '',
    batchSize: 25,
    batchDelayMs: 1000,
    scheduleEnabled: false,
    scheduledAt: '',
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTextField, setActiveTextField] = useState<'text' | 'caption' | 'poll'>('text');

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        title: '', messageType: 'text', text: '', parseMode: '', mediaUrl: '', caption: '',
        pollQuestion: '', pollOptions: [{ text: '' }, { text: '' }], pollIsAnonymous: true,
        pollAllowsMultiple: false, targetType: 'all', segmentId: '', batchSize: 25,
        batchDelayMs: 1000, scheduleEnabled: false, scheduledAt: '',
      });
      setShowAdvanced(false);
      setError(null);
    }
  }, [isOpen]);

  const updateField = <K extends keyof BroadcastFormData>(key: K, value: BroadcastFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const insertVariable = (variable: string) => {
    const insertion = `{{${variable}}}`;
    if (activeTextField === 'text' || activeTextField === 'caption') {
      const field = activeTextField === 'text' ? 'text' : 'caption';
      updateField(field, formData[field] + insertion);
    }
    setShowVariables(false);
  };

  const insertFormatting = (type: 'bold' | 'italic' | 'code' | 'link' | 'strike') => {
    const field = activeTextField === 'text' ? 'text' : 'caption';
    const currentValue = formData[field];
    let insertion = '';
    const mode = formData.parseMode;
    
    switch (type) {
      case 'bold': insertion = mode === 'HTML' ? '<b>txt</b>' : '*txt*'; break;
      case 'italic': insertion = mode === 'HTML' ? '<i>txt</i>' : '_txt_'; break;
      case 'code': insertion = mode === 'HTML' ? '<code>code</code>' : '`code`'; break;
      case 'link': insertion = mode === 'HTML' ? '<a href="url">txt</a>' : '[txt](url)'; break;
      case 'strike': insertion = mode === 'HTML' ? '<s>txt</s>' : '~txt~'; break;
    }
    updateField(field as 'text' | 'caption', currentValue + insertion);
  };

  // Poll logic
  const addPollOption = () => { if (formData.pollOptions.length < 10) updateField('pollOptions', [...formData.pollOptions, { text: '' }]); };
  const removePollOption = (index: number) => { if (formData.pollOptions.length > 2) updateField('pollOptions', formData.pollOptions.filter((_, i) => i !== index)); };
  const updatePollOption = (index: number, text: string) => {
    const newOptions = [...formData.pollOptions];
    newOptions[index] = { text };
    updateField('pollOptions', newOptions);
  };

  const isValid = useCallback(() => {
    if (!formData.title.trim()) return false;
    switch (formData.messageType) {
      case 'text': return formData.text.trim().length > 0;
      case 'photo': case 'video': case 'document': case 'audio': return formData.mediaUrl.trim().length > 0;
      case 'poll': return formData.pollQuestion.trim().length > 0 && formData.pollOptions.filter(o => o.text.trim()).length >= 2;
      default: return false;
    }
  }, [formData]);

  const handleCreate = async () => {
    if (!isValid()) return;
    setCreating(true);
    setError(null);
    
    try {
      const payload: any = {
        title: formData.title.trim(),
        messageType: formData.messageType,
        targetType: formData.targetType,
        segmentId: formData.targetType === 'segment' ? formData.segmentId : undefined,
        batchSize: formData.batchSize,
        batchDelayMs: formData.batchDelayMs,
      };

      if (formData.messageType === 'text') {
        payload.message = formData.text.trim();
        payload.parseMode = formData.parseMode || undefined;
      } else if (['photo', 'video', 'document', 'audio'].includes(formData.messageType)) {
        payload.mediaUrl = formData.mediaUrl;
        payload.caption = formData.caption.trim() || undefined;
        payload.parseMode = formData.parseMode || undefined;
      } else if (formData.messageType === 'poll') {
        payload.pollQuestion = formData.pollQuestion.trim();
        payload.pollOptions = formData.pollOptions.filter(o => o.text.trim()).map(o => o.text.trim());
        payload.pollIsAnonymous = formData.pollIsAnonymous;
        payload.pollAllowsMultiple = formData.pollAllowsMultiple;
      }

      if (formData.scheduleEnabled && formData.scheduledAt) {
        payload.scheduledAt = new Date(formData.scheduledAt).toISOString();
      }

      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onCreated();
        onClose();
      } else {
        setError(data.error || 'Error al crear el broadcast');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setCreating(false);
    }
  };

  const getMediaType = (): MediaType => {
    switch (formData.messageType) {
      case 'photo': return 'image';
      case 'video': return 'video';
      case 'audio': return 'audio';
      default: return 'document';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[560px] bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 shadow-inner">
              <Send className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Nuevo Broadcast</h2>
              <p className="text-xs text-zinc-400">Configura tu campaña masiva</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-8">
            
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* 1. Campaign Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 st">Información de Campaña</h3>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Nombre Interno</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Ej: Newsletter Enero 2026"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
            </div>

            {/* 2. Message Type */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 st">Contenido del Mensaje</h3>
              <div className="grid grid-cols-3 gap-3">
                {MESSAGE_TYPES.map(({ type, label, icon }) => (
                  <button
                    key={type}
                    onClick={() => updateField('messageType', type)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                      formData.messageType === type
                        ? 'bg-violet-500/10 border-violet-500/50 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {icon}
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Editor Area */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-1 overflow-hidden">
              
              {/* Toolbar */}
              {(formData.messageType === 'text' || ['photo', 'video', 'document'].includes(formData.messageType)) && (
                <div className="flex items-center gap-1 p-2 border-b border-zinc-800/50 overflow-x-auto">
                  <select
                    value={formData.parseMode}
                    onChange={(e) => updateField('parseMode', e.target.value as any)}
                    className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none mr-2"
                  >
                    <option value="">Sin formato</option>
                    <option value="Markdown">Markdown</option>
                    <option value="HTML">HTML</option>
                  </select>
                  
                  {formData.parseMode && (
                    <>
                      <ToolBtn onClick={() => insertFormatting('bold')} icon={Bold} title="Negrita" />
                      <ToolBtn onClick={() => insertFormatting('italic')} icon={Italic} title="Cursiva" />
                      <ToolBtn onClick={() => insertFormatting('code')} icon={Code} title="Código" />
                      <ToolBtn onClick={() => insertFormatting('link')} icon={Link} title="Enlace" />
                    </>
                  )}
                  
                  <div className="flex-1" />
                  
                  <div className="relative">
                    <button
                      onClick={() => { setActiveTextField(formData.messageType === 'text' ? 'text' : 'caption'); setShowVariables(!showVariables); }}
                      className="flex items-center gap-1.5 px-2 py-1 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Variables
                    </button>
                    {showVariables && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 overflow-hidden">
                        {AVAILABLE_VARIABLES.map(v => (
                          <button
                            key={v.path}
                            onClick={() => insertVariable(v.path)}
                            className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors flex justify-between"
                          >
                            <span>{v.label}</span>
                            <code className="text-zinc-500">{`{{${v.path.split('.').pop()}}}`}</code>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Inputs */}
              <div className="p-4 space-y-4">
                
                {/* Media Upload */}
                {['photo', 'video', 'document', 'audio'].includes(formData.messageType) && (
                  <div className="bg-zinc-950 border border-zinc-800 border-dashed rounded-xl p-6">
                    <FileUpload
                      mediaType={getMediaType()}
                      value={formData.mediaUrl}
                      onChange={(url) => updateField('mediaUrl', url)}
                    />
                  </div>
                )}

                {/* Text Area */}
                {formData.messageType === 'text' && (
                  <textarea
                    ref={textareaRef}
                    value={formData.text}
                    onChange={(e) => updateField('text', e.target.value.slice(0, 4096))}
                    onFocus={() => setActiveTextField('text')}
                    placeholder="Escribe tu mensaje aquí..."
                    rows={8}
                    className="w-full bg-transparent text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none font-mono text-sm leading-relaxed"
                  />
                )}

                {/* Caption Area */}
                {['photo', 'video', 'document'].includes(formData.messageType) && (
                  <div className="relative">
                    <textarea
                      value={formData.caption}
                      onChange={(e) => updateField('caption', e.target.value.slice(0, 1024))}
                      onFocus={() => setActiveTextField('caption')}
                      placeholder="Añade un comentario (caption)..."
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                    />
                    <span className="absolute bottom-2 right-2 text-[10px] text-zinc-600">{formData.caption.length}/1024</span>
                  </div>
                )}

                {/* Poll Editor */}
                {formData.messageType === 'poll' && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={formData.pollQuestion}
                      onChange={(e) => updateField('pollQuestion', e.target.value.slice(0, 300))}
                      placeholder="Pregunta de la encuesta..."
                      className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    />
                    <div className="space-y-2">
                      {formData.pollOptions.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="flex items-center justify-center w-8 h-10 bg-zinc-900 rounded-lg text-zinc-500 text-xs font-mono">{i + 1}</span>
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => updatePollOption(i, e.target.value)}
                            placeholder={`Opción ${i + 1}`}
                            className="flex-1 px-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                          />
                          {formData.pollOptions.length > 2 && (
                            <button onClick={() => removePollOption(i)} className="p-2 text-zinc-600 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {formData.pollOptions.length < 10 && (
                        <button onClick={addPollOption} className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-500 text-xs hover:bg-zinc-900 transition-colors">
                          + Añadir opción
                        </button>
                      )}
                    </div>
                    <div className="flex gap-4 pt-2">
                      <Toggle label="Anónimo" checked={formData.pollIsAnonymous} onChange={(c) => updateField('pollIsAnonymous', c)} />
                      <Toggle label="Múltiple" checked={formData.pollAllowsMultiple} onChange={(c) => updateField('pollAllowsMultiple', c)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Targeting */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 st">Destinatarios</h3>
              <div className="grid grid-cols-2 gap-3">
                <TargetBtn
                  active={formData.targetType === 'all'}
                  onClick={() => updateField('targetType', 'all')}
                  icon={Users}
                  title="Todos"
                  subtitle="Toda la base de datos"
                />
                <TargetBtn
                  active={formData.targetType === 'segment'}
                  onClick={() => updateField('targetType', 'segment')}
                  icon={Target}
                  title="Segmento"
                  subtitle="Grupo específico"
                />
              </div>
              
              {formData.targetType === 'segment' && (
                <div className="animate-in slide-in-from-top-2 fade-in">
                  <select
                    value={formData.segmentId}
                    onChange={(e) => updateField('segmentId', e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                  >
                    <option value="">Selecciona un segmento...</option>
                    {segments.filter(s => s.isActive).map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.contactCount})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 5. Advanced Settings Toggle */}
            <div className="border-t border-zinc-800 pt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
                Configuración Avanzada
                {showAdvanced ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
              </button>

              {showAdvanced && (
                <div className="mt-4 p-4 bg-zinc-900/50 rounded-xl space-y-5 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Lote (Batch)" value={formData.batchSize} onChange={v => updateField('batchSize', parseInt(v) || 25)} type="number" hint="Máx 30/seg" />
                    <InputGroup label="Delay (ms)" value={formData.batchDelayMs} onChange={v => updateField('batchDelayMs', parseInt(v) || 1000)} type="number" hint="Mín 100ms" />
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-700 transition-colors">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.scheduleEnabled ? 'bg-violet-600 border-violet-600' : 'border-zinc-600'}`}>
                        {formData.scheduleEnabled && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <input type="checkbox" checked={formData.scheduleEnabled} onChange={e => updateField('scheduleEnabled', e.target.checked)} className="hidden" />
                      <div className="flex-1">
                        <span className="block text-sm text-zinc-200">Programar envío</span>
                      </div>
                      <Clock className="w-4 h-4 text-zinc-500" />
                    </label>

                    {formData.scheduleEnabled && (
                      <input
                        type="datetime-local"
                        value={formData.scheduledAt}
                        onChange={(e) => updateField('scheduledAt', e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-violet-500"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-950">
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-3 text-zinc-400 font-medium hover:text-white hover:bg-zinc-900 rounded-xl transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !isValid() || (formData.targetType === 'segment' && !formData.segmentId)}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium rounded-xl shadow-lg shadow-violet-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span>{formData.scheduleEnabled ? 'Programar' : 'Crear Broadcast'}</span>
            </button>
          </div>
        </div>

      </div>
    </>
  );
}

// ============= SUB-COMPONENTS =============

const ToolBtn = ({ onClick, icon: Icon, title }: { onClick: () => void; icon: React.ComponentType<any>; title: string }) => (
  <button onClick={onClick} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 rounded transition-colors" title={title}>
    <Icon className="w-3.5 h-3.5" />
  </button>
);

const TargetBtn = ({ active, onClick, icon: Icon, title, subtitle }: { active: boolean; onClick: () => void; icon: React.ComponentType<any>; title: string; subtitle: string }) => (
  <button
    onClick={onClick}
    className={`p-4 rounded-xl border text-left transition-all duration-200 ${
      active ? 'bg-violet-500/10 border-violet-500/50 shadow-[0_0_10px_rgba(139,92,246,0.1)]' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
    }`}
  >
    <div className={`mb-2 ${active ? 'text-violet-400' : 'text-zinc-500'}`}><Icon className="w-5 h-5" /></div>
    <div className={`text-sm font-medium ${active ? 'text-white' : 'text-zinc-300'}`}>{title}</div>
    <div className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</div>
  </button>
);

const InputGroup = ({ label, value, onChange, type, hint }: { label: string; value: string | number; onChange: (value: string) => void; type: string; hint?: string }) => (
  <div>
    <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-violet-500"
    />
    {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
  </div>
);

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <div className={`w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-violet-600' : 'bg-zinc-700'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${checked ? 'left-5' : 'left-1'}`} />
    </div>
    <span className="text-xs text-zinc-300">{label}</span>
  </label>
);