/**
 * NodePalette - Sidebar with draggable nodes
 * Refactored: Premium Zinc Style (Full Feature Set)
 */

import React, { useState } from 'react';
import type { NodeType } from '../../types/flow';
import { 
  Zap, GitFork, PlayCircle, Clock, CheckSquare, Search, 
  MessageSquare, User, Hash, Pause, MousePointerClick, 
  ChevronDown, MessageCircle, MapPin, Phone, StickyNote,
  Globe, Layout, Sticker, RefreshCw, XCircle, 
  Workflow, UserPlus, FileText, Keyboard, ArrowRightLeft,
  FolderInput, Pin, PinOff, Activity, Webhook, Edit3, 
  Copy, Save, Trash2, Delete
} from 'lucide-react';

interface NodePaletteProps {
  onAddNode: (type: NodeType, label: string, config: any) => void;
}

// Interfaces internas
interface NodeItem {
  type: NodeType;
  subType?: string;
  label: string;
  description: string;
  config: any;
  icon: React.ElementType;
}

interface NodeSubCategory {
  id: string;
  label: string;
  icon?: React.ElementType;
  items: NodeItem[];
}

interface NodeCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items?: NodeItem[];
  subCategories?: NodeSubCategory[];
}

// Estilos por tipo de nodo
const getNodeStyles = (type: NodeType) => {
  switch (type) {
    case 'trigger': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
    case 'condition': return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
    case 'action': return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
    case 'delay': return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' };
    case 'end': return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' };
    default: return { bg: 'bg-zinc-800', text: 'text-zinc-400', border: 'border-zinc-700' };
  }
};

const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('triggers');
  const [searchQuery, setSearchQuery] = useState('');

  // ==================== DEFINICIÓN COMPLETA DE NODOS ====================
  const categories: NodeCategory[] = [
    {
      id: 'triggers',
      label: 'Disparadores (Triggers)',
      icon: Zap,
      color: 'text-emerald-400',
      items: [
        { type: 'trigger', subType: 'chat_created', label: 'Chat Creado', description: 'Al iniciar nueva sesión', config: { triggerType: 'chat_created' }, icon: MessageCircle },
        { type: 'trigger', subType: 'message_received', label: 'Mensaje Recibido', description: 'Cualquier mensaje entrante', config: { triggerType: 'message_received' }, icon: MessageSquare },
        { type: 'trigger', subType: 'keyword_detected', label: 'Palabra Clave', description: 'Detectar texto específico', config: { triggerType: 'keyword_detected', keywords: [] }, icon: Hash },
        { type: 'trigger', subType: 'user_inactive', label: 'Usuario Inactivo', description: 'Sin respuesta por X min', config: { triggerType: 'user_inactive', inactivityMinutes: 5 }, icon: Clock },
        { type: 'trigger', subType: 'chat_assigned', label: 'Chat Asignado', description: 'Al asignar a agente', config: { triggerType: 'chat_assigned' }, icon: UserPlus },
        { type: 'trigger', subType: 'chat_closed', label: 'Chat Cerrado', description: 'Al finalizar sesión', config: { triggerType: 'chat_closed' }, icon: XCircle },
        { type: 'trigger', subType: 'survey_answered', label: 'Encuesta Respondida', description: 'Feedback de usuario', config: { triggerType: 'survey_answered' }, icon: CheckSquare },
      ],
    },
    {
      id: 'conditions',
      label: 'Lógica y Flujo',
      icon: GitFork,
      color: 'text-amber-400',
      items: [
        { type: 'condition', label: 'Condición Si/No', description: 'Ramificar flujo por reglas', config: { rules: [] }, icon: GitFork },
      ],
    },
    {
      id: 'actions',
      label: 'Acciones',
      icon: PlayCircle,
      color: 'text-blue-400',
      subCategories: [
        {
          id: 'messages', label: 'Mensajería Básica', icon: MessageSquare,
          items: [
            { type: 'action', subType: 'send_message', label: 'Enviar Texto', description: 'Mensaje simple', config: { actionType: 'send_message' }, icon: MessageSquare },
            { type: 'action', subType: 'edit_message', label: 'Editar Mensaje', description: 'Modificar mensaje previo', config: { actionType: 'edit_message' }, icon: Edit3 },
            { type: 'action', subType: 'delete_message', label: 'Eliminar Mensaje', description: 'Borrar del chat', config: { actionType: 'delete_message' }, icon: Trash2 },
            { type: 'action', subType: 'copy_message', label: 'Copiar Mensaje', description: 'Duplicar contenido', config: { actionType: 'copy_message' }, icon: Copy },
            { type: 'action', subType: 'save_message_id', label: 'Guardar ID Msg', description: 'Almacenar ID en variable', config: { actionType: 'save_message_id' }, icon: Save },
          ]
        },
        {
          id: 'special_content', label: 'Contenido Multimedia', icon: MapPin,
          items: [
            { type: 'action', subType: 'send_location', label: 'Enviar Ubicación', description: 'Coordenadas GPS', config: { actionType: 'send_location' }, icon: MapPin },
            { type: 'action', subType: 'send_contact', label: 'Enviar Contacto', description: 'Tarjeta de contacto', config: { actionType: 'send_contact' }, icon: Phone },
            { type: 'action', subType: 'send_sticker', label: 'Enviar Sticker', description: 'Sticker de Telegram', config: { actionType: 'send_sticker' }, icon: Sticker },
          ]
        },
        {
          id: 'keyboards', label: 'Teclados y Botones', icon: Keyboard,
          items: [
            { type: 'action', subType: 'edit_keyboard', label: 'Editar Inline KB', description: 'Cambiar botones', config: { actionType: 'edit_keyboard' }, icon: Keyboard },
            { type: 'action', subType: 'remove_keyboard', label: 'Quitar Inline KB', description: 'Borrar botones', config: { actionType: 'remove_keyboard' }, icon: Delete },
            { type: 'action', subType: 'send_reply_keyboard', label: 'Enviar Reply KB', description: 'Menú persistente', config: { actionType: 'send_reply_keyboard' }, icon: Layout },
            { type: 'action', subType: 'remove_reply_keyboard', label: 'Ocultar Reply KB', description: 'Cerrar menú', config: { actionType: 'remove_reply_keyboard' }, icon: XCircle },
          ]
        },
        {
          id: 'chat_management', label: 'Gestión del Chat', icon: User,
          items: [
            { type: 'action', subType: 'wait_for_response', label: 'Esperar Respuesta', description: 'Pausar hasta input', config: { actionType: 'wait_for_response' }, icon: MousePointerClick },
            { type: 'action', subType: 'send_chat_action', label: 'Estado (Typing)', description: 'Escribiendo...', config: { actionType: 'send_chat_action' }, icon: Activity },
            { type: 'action', subType: 'assign_agent', label: 'Asignar Agente', description: 'Enrutar a humano', config: { actionType: 'assign_agent' }, icon: UserPlus },
            { type: 'action', subType: 'transfer_chat', label: 'Transferir', description: 'Mover a otro equipo', config: { actionType: 'transfer_chat' }, icon: ArrowRightLeft },
            { type: 'action', subType: 'change_category', label: 'Cambiar Categoría', description: 'Clasificar chat', config: { actionType: 'change_category' }, icon: FolderInput },
            { type: 'action', subType: 'add_tag', label: 'Añadir Etiqueta', description: 'Taggear chat', config: { actionType: 'add_tag' }, icon: Hash },
            { type: 'action', subType: 'remove_tag', label: 'Quitar Etiqueta', description: 'Remover tag', config: { actionType: 'remove_tag' }, icon: Hash },
            { type: 'action', subType: 'create_note', label: 'Nota Interna', description: 'Comentario privado', config: { actionType: 'create_note' }, icon: StickyNote },
            { type: 'action', subType: 'pin_message', label: 'Fijar Mensaje', description: 'Pin en el chat', config: { actionType: 'pin_message' }, icon: Pin },
            { type: 'action', subType: 'unpin_message', label: 'Desfijar Mensaje', description: 'Unpin mensaje', config: { actionType: 'unpin_message' }, icon: PinOff },
            { type: 'action', subType: 'close_chat', label: 'Cerrar Chat', description: 'Finalizar sesión', config: { actionType: 'close_chat' }, icon: XCircle },
          ]
        },
        {
          id: 'integrations', label: 'Integraciones', icon: Globe,
          items: [
            { type: 'action', subType: 'call_webhook', label: 'Webhook', description: 'POST a URL externa', config: { actionType: 'call_webhook' }, icon: Webhook },
            { type: 'action', subType: 'api_call', label: 'API Call', description: 'Petición HTTP avanzada', config: { actionType: 'api_call' }, icon: Globe },
            { type: 'action', subType: 'send_survey', label: 'Enviar Encuesta', description: 'CSAT / NPS', config: { actionType: 'send_survey' }, icon: FileText },
            { type: 'action', subType: 'run_subflow', label: 'Ejecutar Sub-flow', description: 'Llamar otro flujo', config: { actionType: 'run_subflow' }, icon: RefreshCw },
          ]
        }
      ],
    },
    {
      id: 'delays',
      label: 'Tiempos y Esperas',
      icon: Clock,
      color: 'text-violet-400',
      items: [
        { type: 'delay', subType: 'fixed_time', label: 'Delay Fijo', description: 'Esperar X tiempo', config: { delayType: 'fixed_time' }, icon: Pause },
        { type: 'delay', subType: 'until_response', label: 'Hasta Respuesta', description: 'Esperar al usuario', config: { delayType: 'until_response' }, icon: MessageCircle },
        { type: 'delay', subType: 'until_agent_online', label: 'Esperar Agente', description: 'Hasta disponibilidad', config: { delayType: 'until_agent_online' }, icon: User },
      ],
    },
    {
        id: 'flow_control',
        label: 'Control de Flujo',
        icon: Workflow,
        color: 'text-red-400',
        items: [
            { type: 'end', label: 'Fin del Flujo', description: 'Terminar proceso', config: {}, icon: XCircle }
        ]
    }
  ];

  // Drag Handlers
  const onDragStart = (event: React.DragEvent, item: NodeItem) => {
    event.dataTransfer.setData('application/reactflow/type', item.type);
    event.dataTransfer.setData('application/reactflow/label', item.label);
    event.dataTransfer.setData('application/reactflow/config', JSON.stringify(item.config));
    event.dataTransfer.effectAllowed = 'move';
  };

  // Filter Logic
  const filterItems = (items: NodeItem[]) => {
    if (!searchQuery) return items;
    return items.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  // Render Node Item Component
  const renderItem = (item: NodeItem, idx: number) => {
    const styles = getNodeStyles(item.type);
    const Icon = item.icon;

    return (
      <div
        key={`${item.type}-${item.subType || idx}`}
        draggable
        onDragStart={(e) => onDragStart(e, item)}
        onClick={() => onAddNode(item.type, item.label, item.config)}
        className="group flex items-center gap-3 p-2.5 mx-2 mb-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg cursor-grab active:cursor-grabbing transition-all hover:bg-zinc-800/50"
      >
        <div className={`p-2 rounded-md ${styles.bg} ${styles.text} border ${styles.border}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-zinc-200 truncate">{item.label}</p>
          <p className="text-[10px] text-zinc-500 truncate group-hover:text-zinc-400 transition-colors">
            {item.description}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-72 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col overflow-hidden">
      
      {/* Header & Search */}
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-sm font-bold text-zinc-50 mb-3 uppercase r opacity-80">
          Nodos de Flujo
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar componente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-600" />
        </div>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="py-2">
          {categories.map((cat) => {
            const hasSubcategories = !!cat.subCategories;
            const items = cat.items || [];
            
            // Search Filtering logic to keep categories open if needed
            let categoryHasMatches = false;
            if (searchQuery) {
               const directMatches = filterItems(items).length > 0;
               const subMatches = cat.subCategories?.some(sub => filterItems(sub.items).length > 0);
               categoryHasMatches = directMatches || !!subMatches;
               if (!categoryHasMatches) return null;
            }

            const isExpanded = expandedCategory === cat.id || !!searchQuery;
            const Icon = cat.icon;

            return (
              <div key={cat.id} className="mb-1">
                {/* Category Header */}
                <button
                  onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                  className={`w-full flex items-center justify-between px-4 py-5 hover:bg-zinc-900/50 transition-colors ${isExpanded ? 'text-zinc-200' : 'text-zinc-500'}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-5 h-5 ${isExpanded ? cat.color : 'text-zinc-600'}`} />
                    {/* teeeeeeeeeeexto mas grande */}
                    <span className="font-bold text-[14px]">{cat.label}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Items Container */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  
                  {/* Direct Items */}
                  {items.length > 0 && (
                    <div className="pb-2">
                      {filterItems(items).map((item, idx) => renderItem(item, idx))}
                    </div>
                  )}

                  {/* Subcategories */}
                  {hasSubcategories && cat.subCategories!.map(sub => {
                    const subItems = filterItems(sub.items);
                    if (searchQuery && subItems.length === 0) return null;

                    return (
                      <div key={sub.id} className="mb-2">
                        <div className="px-4 py-1.5 flex items-center gap-2">
                           <div className="w-1 h-1 rounded-full bg-zinc-700" />
                           <span className="text-[10px] font-bold text-zinc-500 uppercase ">
                             {sub.label}
                           </span>
                        </div>
                        {subItems.map((item, idx) => renderItem(item, idx))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/30">
        <p className="text-[12px] text-zinc-500 text-center flex items-center justify-center gap-1.5">
          <MousePointerClick className="w-3 h-3" />
          Arrastra para añadir al flujo
        </p>
      </div>

    </div>
  );
};

export default NodePalette;