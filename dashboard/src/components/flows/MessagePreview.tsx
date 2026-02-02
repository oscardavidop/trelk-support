/**
 * MessagePreview - Preview de mensajes tipo Telegram
 * Muestra cómo se vería el mensaje en un chat real
 */

import React, { useState } from 'react';
import type { MessageBlock, KeyboardConfig, TextBlock } from '../../types/flow';
import { CheckCheck, Eye, EyeOff, FileText, Play } from 'lucide-react';

interface MessagePreviewProps {
  blocks: MessageBlock[];
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * Renderiza texto con formato HTML como lo haría Telegram
 * Soporta: <b>, <i>, <u>, <s>, <code>, <pre>, <a>
 */
function renderTelegramHTML(text: string): React.ReactNode {
  if (!text) return null;
  
  // Escapar caracteres peligrosos primero, luego procesar tags permitidos
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  // Regex para encontrar tags HTML de Telegram
  const tagRegex = /<(b|i|u|s|code|pre|a)(?: href="([^"]*)")?>([\s\S]*?)<\/\1>/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = tagRegex.exec(text)) !== null) {
    // Agregar texto antes del match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    const [, tag, href, content] = match;
    const tagLower = tag.toLowerCase();
    
    // Renderizar según el tag
    switch (tagLower) {
      case 'b':
        parts.push(<strong key={key++} className="font-bold">{renderTelegramHTML(content)}</strong>);
        break;
      case 'i':
        parts.push(<em key={key++} className="italic">{renderTelegramHTML(content)}</em>);
        break;
      case 'u':
        parts.push(<u key={key++} className="underline">{renderTelegramHTML(content)}</u>);
        break;
      case 's':
        parts.push(<s key={key++} className="line-through">{renderTelegramHTML(content)}</s>);
        break;
      case 'code':
        parts.push(
          <code key={key++} className="bg-black/20 px-1 py-0.5 rounded text-xs font-mono">
            {content}
          </code>
        );
        break;
      case 'pre':
        parts.push(
          <pre key={key++} className="bg-black/20 p-2 rounded text-xs font-mono overflow-x-auto my-1">
            {content}
          </pre>
        );
        break;
      case 'a':
        parts.push(
          <a
            key={key++}
            href={href || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-200 underline hover:text-blue-100"
          >
            {content}
          </a>
        );
        break;
      default:
        parts.push(content);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Agregar texto restante
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

/**
 * Renderiza texto con formato Markdown como lo haría Telegram
 * Soporta: *bold*, _italic_, `code`, ```pre```, [link](url)
 */
function renderTelegramMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  // Procesar en orden: code blocks, inline code, bold, italic, links
  const patterns = [
    { regex: /```([\s\S]*?)```/g, render: (content: string) => (
      <pre key={key++} className="bg-black/20 p-2 rounded text-xs font-mono overflow-x-auto my-1">{content}</pre>
    )},
    { regex: /`([^`]+)`/g, render: (content: string) => (
      <code key={key++} className="bg-black/20 px-1 py-0.5 rounded text-xs font-mono">{content}</code>
    )},
    { regex: /\*([^*]+)\*/g, render: (content: string) => (
      <strong key={key++} className="font-bold">{content}</strong>
    )},
    { regex: /_([^_]+)_/g, render: (content: string) => (
      <em key={key++} className="italic">{content}</em>
    )},
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, render: (content: string, url: string) => (
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-200 underline hover:text-blue-100">{content}</a>
    )},
  ];
  
  // Aplicar primer patrón encontrado recursivamente
  for (const pattern of patterns) {
    const match = pattern.regex.exec(remaining);
    if (match) {
      const before = remaining.substring(0, match.index);
      const after = remaining.substring(match.index + match[0].length);
      
      if (before) parts.push(renderTelegramMarkdown(before));
      
      parts.push(pattern.render(match[1], match[2]));
      
      if (after) parts.push(renderTelegramMarkdown(after));
      
      return parts;
    }
  }
  
  return text;
}

/**
 * Renderiza contenido según el parseMode
 */
function renderFormattedContent(content: string, parseMode?: string): React.ReactNode {
  if (!content) return '(vacío)';
  
  switch (parseMode) {
    case 'HTML':
      return renderTelegramHTML(content);
    case 'Markdown':
    case 'MarkdownV2':
      return renderTelegramMarkdown(content);
    default:
      return content;
  }
}

export const MessagePreview: React.FC<MessagePreviewProps> = ({ blocks, className = '', defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (blocks.length === 0) return null;

  // Renderizado de Teclado Inline
  const renderKeyboard = (keyboard: KeyboardConfig | undefined) => {
    if (!keyboard || keyboard.type !== 'inline' || !keyboard.rows?.length) return null;

    return (
      <div className="mt-2 space-y-1">
        {keyboard.rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-1 w-full">
            {row.buttons.map((btn, btnIdx) => (
              <div
                key={btnIdx}
                className="flex-1 min-w-0 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded px-3 py-2 text-center cursor-default transition-colors border border-white/5 shadow-sm"
              >
                <span className="text-xs font-medium text-white block truncate">{btn.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Renderizado de Bloques
  const renderContent = () => {
    return (
      <div className="space-y-2">
        {blocks.map((block, idx) => (
          <div key={`${block.id}-${idx}`} className="space-y-1">
            
            {/* Texto */}
            {block.type === 'text' && (
              <div>{renderFormattedContent(block.content || '', (block as TextBlock).parseMode)}</div>
            )}

            {/* Imagen */}
            {block.type === 'image' && block.url && (
              <div className="rounded-lg overflow-hidden mb-1 relative">
                <img src={block.url} alt="Media" className="w-full h-auto object-cover max-h-[300px]" onError={(e) => (e.currentTarget.style.display = 'none')} />
                {/* Gradient overlay for text readability if caption exists could be added here */}
              </div>
            )}

            {/* Documento */}
            {block.type === 'document' && block.url && (
              <div className="flex items-center gap-3 p-2 bg-black/10 rounded-lg">
                <div className="p-2 bg-blue-500 rounded-full text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-white">{block.filename || 'Archivo'}</div>
                  <div className="text-xs opacity-70">Documento</div>
                </div>
              </div>
            )}

            {/* Audio */}
            {block.type === 'audio' && block.url && (
              <div className="flex items-center gap-3 p-2 bg-black/10 rounded-lg">
                <div className="p-2 bg-blue-500 rounded-full text-white">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                   <div className="w-1/3 h-full bg-white/80" />
                </div>
                <div className="text-xs font-mono opacity-80">0:15</div>
              </div>
            )}

            {/* Caption Global */}
            {['image', 'video', 'document', 'audio'].includes(block.type) && (block as any).caption && (
              <div className="text-sm mt-1">{renderFormattedContent((block as any).caption)}</div>
            )}

            {/* Delay Indicator (Visual only, not bubble) */}
            {block.type === 'delay' && (
              <div className="flex justify-center my-2">
                 <span className="text-[10px] bg-black/20 text-white/60 px-2 py-0.5 rounded-full">
                   ⏳ Esperando {(block as any).seconds}s...
                 </span>
              </div>
            )}

            {/* Teclado Inline asociado al bloque */}
            {block.type !== 'delay' && (block as any).keyboard && renderKeyboard((block as any).keyboard)}

          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`mt-4 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 ${className}`}>
      
      {/* Header Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-500/10 rounded text-sky-400">
            {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-bold text-zinc-300 uppercase ">Vista Previa (Telegram)</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-medium">
          {isExpanded ? 'Ocultar' : 'Mostrar'}
        </span>
      </button>

      {/* Preview Content Area */}
      {isExpanded && (
        <div className="relative p-4 bg-[#0e1621] bg-opacity-95" style={{ 
          backgroundImage: 'url("https://web.telegram.org/img/bg_0.png")', // Telegram Dark Pattern (Optional)
          backgroundSize: 'cover'
        }}>
          {/* Mock Time Header */}
          <div className="text-center mb-4">
            <span className="bg-black/20 text-white/60 text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
              Hoy
            </span>
          </div>

          <div className="flex flex-col items-end space-y-2">
            {/* The Bubble */}
            <div className="max-w-[85%] bg-[#2b5278] text-white rounded-2xl rounded-tr-sm p-2.5 shadow-sm relative group">
              {renderContent()}
              
              {/* Meta Info (Time & Check) */}
              <div className="flex justify-end items-center gap-1 mt-1 select-none">
                <span className="text-[10px] text-sky-200/60">12:45 PM</span>
                <CheckCheck className="w-3 h-3 text-sky-400" />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};


