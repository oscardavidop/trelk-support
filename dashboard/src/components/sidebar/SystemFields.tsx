import { useState } from 'react';
import { Copy, Check, User, AtSign, Type } from 'lucide-react';

interface SystemFieldsProps {
  user: {
    firstName: string;
    lastName?: string;
    username?: string;
  };
}

export function SidebarSystemFields({ user }: SystemFieldsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string | undefined | null, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fields = [
    { key: 'first_name', label: 'Nombre', value: user.firstName, icon: User },
    { key: 'last_name', label: 'Apellido', value: user.lastName, icon: Type },
    { key: 'username', label: 'Username', value: user.username ? `@${user.username}` : null, icon: AtSign },
  ];

  return (
    <div className="px-3 py-2">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {fields.map((field, index) => (
          <div 
            key={field.key}
            className={`
              group flex items-center justify-between px-4 py-3
              ${index !== fields.length - 1 ? 'border-b border-zinc-800' : ''}
              ${field.value ? 'hover:bg-zinc-800/50 cursor-pointer transition-colors' : 'cursor-default'}
            `}
            onClick={() => handleCopy(field.value, field.key)}
          >
            {/* Label & Icon */}
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-zinc-950 rounded border border-zinc-800 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                 <field.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">
                {field.label}
              </span>
            </div>

            {/* Value & Actions */}
            <div className="flex items-center gap-3">
              <span className={`text-xs text-right truncate max-w-[140px] ${
                field.value 
                  ? 'text-zinc-200 font-medium' 
                  : 'text-zinc-600 italic'
              }`}>
                {field.value || 'Vacío'}
              </span>
              
              {/* Copy Feedback Icon */}
              {field.value && (
                <div className="w-4 h-4 flex items-center justify-center">
                  {copiedField === field.key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in duration-200" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-300" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <p className="mt-2 text-[10px] text-zinc-500 text-center">
        Clic para copiar al portapapeles
      </p>
    </div>
  );
}