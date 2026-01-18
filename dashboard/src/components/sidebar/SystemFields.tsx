// // System Fields Section
// interface SystemFieldsProps {
//   user: {
//     firstName: string;
//     lastName?: string;
//     username?: string;
//   };
// }

// export function SidebarSystemFields({ user }: SystemFieldsProps) {
//   const fields = [
//     { label: 'Nombre', value: user.firstName },
//     { label: 'Apellido', value: user.lastName },
//     { label: 'Username', value: user.username ? `@${user.username}` : null },
//   ];

//   return (
//     <div className="px-4 py-2 space-y-2">
//       {fields.map((field) => (
//         <div key={field.label} className="flex items-center justify-between">
//           <span className="text-xs text-gray-500 dark:text-gray-400">{field.label}</span>
//           <span className={`text-xs ${
//             field.value 
//               ? 'text-gray-700 dark:text-gray-300' 
//               : 'text-gray-400 dark:text-gray-500 italic'
//           }`}>
//             {field.value || 'No establecido'}
//           </span>
//         </div>
//       ))}
//     </div>
//   );
// }

// SidebarSystemFields.tsx - Refactored UI
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
      <div className="bg-gray-50 dark:bg-[#1a1d26] border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
        {fields.map((field, index) => (
          <div 
            key={field.key}
            className={`
              group flex items-center justify-between px-3 py-2.5 
              ${index !== fields.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}
              ${field.value ? 'hover:bg-gray-100 dark:hover:bg-gray-800/80 cursor-pointer transition-colors' : ''}
            `}
            onClick={() => handleCopy(field.value, field.key)}
          >
            {/* Label & Icon */}
            <div className="flex items-center gap-2">
              <field.icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {field.label}
              </span>
            </div>

            {/* Value & Actions */}
            <div className="flex items-center gap-2">
              <span className={`text-xs text-right truncate max-w-[120px] ${
                field.value 
                  ? 'text-gray-900 dark:text-gray-200 font-medium' 
                  : 'text-gray-400 dark:text-gray-600 italic'
              }`}>
                {field.value || 'No establecido'}
              </span>
              
              {/* Copy Feedback Icon */}
              {field.value && (
                <div className="w-4 h-4 flex items-center justify-center">
                  {copiedField === field.key ? (
                    <Check className="w-3 h-3 text-green-500 animate-in zoom-in duration-200" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <p className="mt-2 text-[10px] text-gray-400 text-center">
        Haz clic en un campo para copiar su valor
      </p>
    </div>
  );
}