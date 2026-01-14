/**
 * MessagePreview - Preview de mensajes tipo Telegram
 * Muestra cómo se vería el mensaje en un chat real
 */

import React, { useState } from 'react';
import type { MessageBlock, KeyboardConfig, TextBlock } from '../../types/flow';

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

  if (blocks.length === 0) {
    return null;
  }

  // Renderizar botones como los vería Telegram
  const renderKeyboard = (keyboard: KeyboardConfig | undefined) => {
    if (!keyboard || keyboard.type !== 'inline' || !keyboard.rows || keyboard.rows.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 space-y-1">
        {keyboard.rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-1 flex-wrap">
            {row.buttons.map((btn, btnIdx) => (
              <button
                key={btnIdx}
                disabled
                className="text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex-1 min-w-max"
                title={btn.text}
              >
                {btn.text}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Renderizar un bloque de contenido
  const renderContent = () => {
    return (
      <div className="space-y-2">
        {blocks.map((block, idx) => (
          <div key={`${block.id}-${idx}`}>
            {block.type === 'text' && (
              <div className="text-sm text-white whitespace-pre-wrap break-words">
                {renderFormattedContent(block.content || '', (block as TextBlock).parseMode)}
              </div>
            )}
            {block.type === 'image' && block.url && (
              <div className="flex flex-col gap-2">
                <img
                  src={block.url}
                  alt="Preview"
                  className="max-w-full h-auto rounded max-h-48 object-cover bg-gray-200 dark:bg-gray-700"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {block.caption && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {block.caption}
                  </div>
                )}
              </div>
            )}
            {block.type === 'document' && block.url && (
              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                    {block.filename || 'Documento'}
                  </div>
                  {block.caption && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {block.caption}
                    </div>
                  )}
                </div>
              </div>
            )}
            {block.type === 'audio' && block.url && (
              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {(block as any).isVoiceNote ? '🎙️ Nota de voz' : 'Audio'}
                  </div>
                  {(block as any).caption && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {(block as any).caption}
                    </div>
                  )}
                </div>
              </div>
            )}
            {block.type === 'video' && block.url && (
              <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Video
                  </div>
                  {block.caption && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {block.caption}
                    </div>
                  )}
                </div>
              </div>
            )}
            {block.type === 'delay' && (
              <div className="flex items-center gap-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs text-amber-700 dark:text-amber-300">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>⏳ Esperar {block.seconds}s</span>
              </div>
            )}

            {/* Mostrar teclado del bloque si existe */}
            {block.type !== 'delay' && (block as any).keyboard && renderKeyboard((block as any).keyboard)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`mt-4 ${className}`}>
      {/* Header colapsable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-gradient-to-r hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/50 dark:hover:to-cyan-900/50 transition-all"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <div className="text-left">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 block">
              Vista previa del mensaje
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {isExpanded ? 'Cerrar' : 'Abre para ver cómo se verá en Telegram'}
            </span>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-blue-600 dark:text-blue-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Preview Content */}
      {isExpanded && (
        <div className="mt-2 p-4 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg">
          {/* Telegram Style Chat Bubble */}
          <div className="flex justify-end mb-3">
            <div className="max-w-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-none p-4 space-y-2 shadow-lg">
              {renderContent()}
            </div>
          </div>

          {/* Info Footer */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <span>Actualización en tiempo real</span>
            </div>
            <span className="text-blue-600 dark:text-blue-400 font-medium">Telegram</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagePreview;
