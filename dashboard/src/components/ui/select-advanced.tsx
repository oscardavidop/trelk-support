/**
 * Advanced Select Components (shadcn/ui style)
 */

import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

interface SelectProps {
  value?: any;
  onValueChange?: (value: any) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Select({ value = '', onValueChange, disabled, children }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  
  const handleValueChange = React.useCallback((newValue: string) => {
    onValueChange?.(newValue);
    setOpen(false);
  }, [onValueChange]);

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen, disabled }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

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
      className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg border border-gray-700 bg-gray-800 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
      <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${context.open ? 'rotate-180' : ''}`} />
    </button>
  );
}

interface SelectValueProps {
  placeholder?: React.ReactNode;
  children?: React.ReactNode;
}

export function SelectValue({ placeholder, children }: SelectValueProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');

  if (children) {
    return <span>{children}</span>;
  }

  if (!context.value) {
    return <span className="text-gray-500">{placeholder}</span>;
  }

  return <span>{context.value}</span>;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SelectContent({ children, className = '' }: SelectContentProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectContent must be used within Select');

  if (!context.open) return null;

  return (
    <>
      {/* Backdrop to close dropdown */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => context.setOpen(false)} 
      />
      
      {/* Dropdown content */}
      <div className={`absolute z-50 w-full mt-1 py-1 rounded-lg border border-gray-700 bg-gray-800 shadow-xl max-h-60 overflow-auto ${className}`}>
        {children}
      </div>
    </>
  );
}

interface SelectItemProps {
  value: string;
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
      onClick={() => !disabled && context.onValueChange(value)}
      className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-gray-700/50 text-primary' : 'text-white'} ${className}`}
    >
      <span>{children}</span>
      {isSelected && <Check className="w-4 h-4 text-primary" />}
    </button>
  );
}

// Re-export the original simple Select as SelectSimple
export { Select as SelectAdvanced };
