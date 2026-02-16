/**
 * Select Components - Premium Zinc Refactor
 * High-fidelity, composable select inputs (Shadcn/UI style)
 */

import * as React from 'react';
import { ChevronDown, Check, ChevronsUpDown } from 'lucide-react';

// ============= CONTEXT =============

interface SelectContextValue {
  value: any;
  onValueChange: (value: any) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

// ============= ROOT COMPONENT =============

interface SelectProps {
  value?: any;
  onValueChange?: (value: any) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Select({ value, onValueChange, disabled, children }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  
  const handleValueChange = React.useCallback((newValue: any) => {
    onValueChange?.(newValue);
    setOpen(false);
  }, [onValueChange]);

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen, disabled }}>
      <div className="relative group">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

// ============= TRIGGER =============

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function SelectTrigger({ children, className = '' }: SelectTriggerProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectTrigger must be used within Select');

  return (
    <button
      type="button"
      onClick={() => !context.disabled && context.setOpen(!context.open)}
      disabled={context.disabled}
      className={`
        flex items-center justify-between w-full px-3.5 py-2.5 
        bg-zinc-950 border border-zinc-800 rounded-xl
        text-sm text-zinc-200 font-medium
        transition-all duration-200
        hover:border-zinc-700 hover:bg-zinc-900/50
        focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50
        disabled:opacity-50 disabled:cursor-not-allowed
        data-[state=open]:border-indigo-500/50
        ${className}
      `}
      data-state={context.open ? 'open' : 'closed'}
    >
      {children}
      <ChevronsUpDown className="w-4 h-4 text-zinc-500 opacity-50 shrink-0 ml-2" />
    </button>
  );
}

// ============= VALUE DISPLAY =============

interface SelectValueProps {
  placeholder?: React.ReactNode;
  children?: React.ReactNode; // Optional fallback
}

export function SelectValue({ placeholder, children }: SelectValueProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');

  // Nota: En una implementación real completa, aquí buscaríamos la 'label' correspondiente
  // al 'value' actual recorriendo los children o usando un map.
  // Para este componente visual, mostramos el children si existe, el value, o el placeholder.

  if (children) return <span className="truncate">{children}</span>;

  if (!context.value || context.value === '') {
    return <span className="text-zinc-500 truncate">{placeholder}</span>;
  }

  return <span className="truncate">{context.value}</span>;
}

// ============= DROPDOWN CONTENT =============

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'center';
}

export function SelectContent({ children, className = '', align = 'start' }: SelectContentProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectContent must be used within Select');

  if (!context.open) return null;

  return (
    <>
      {/* Invisible Backdrop to handle click-outside */}
      <div 
        className="fixed inset-0 z-40 bg-transparent" 
        onClick={() => context.setOpen(false)} 
      />
      
      {/* Content Panel */}
      <div 
        className={`
          absolute z-50 w-full min-w-[8rem] mt-2 
          overflow-hidden rounded-xl border border-zinc-800 
          bg-zinc-950/95 backdrop-blur-xl 
          shadow-2xl shadow-black/50
          animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200
          ${align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'}
          ${className}
        `}
      >
        <div className="p-1 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {children}
        </div>
      </div>
    </>
  );
}

// ============= ITEM =============

interface SelectItemProps {
  value: any;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SelectItem({ value, disabled, children, className = '' }: SelectItemProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectItem must be used within Select');

  const isSelected = context.value === value;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation(); // Prevent closing immediately if we want animations, but usually we want instant close
        !disabled && context.onValueChange(value);
      }}
      className={`
        relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-2 pr-8 text-xs sm:text-sm outline-none transition-colors
        ${disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        ${isSelected 
          ? 'bg-indigo-500/10 text-indigo-400 font-medium' 
          : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100'
        }
        ${className}
      `}
    >
      <span className="flex-1 text-left truncate">{children}</span>
      
      {isSelected && (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center text-indigo-500">
          <Check className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}

// ============= LABEL/SEPARATOR (Extras) =============

export function SelectLabel({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return <div className={`px-2 py-1.5 text-xs font-bold text-zinc-500 uppercase  ${className}`}>{children}</div>;
}

export function SelectSeparator({ className = '' }: { className?: string }) {
  return <div className={`-mx-1 my-1 h-px bg-zinc-800 ${className}`} />;
}