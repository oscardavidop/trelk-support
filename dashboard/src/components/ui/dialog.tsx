/**
 * Dialog Components (shadcn/ui style)
 */

import * as React from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => {} });

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    onOpenChange?.(newOpen);
  }, [onOpenChange]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({ children, className = '' }: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Content */}
      <div 
        className={`relative z-50 w-full max-w-lg rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
        
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, className = '' }: DialogHeaderProps) {
  return (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className = '' }: DialogTitleProps) {
  return (
    <h2 className={`text-lg font-semibold leading-none tracking-tight text-white ${className}`}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className = '' }: DialogDescriptionProps) {
  return (
    <p className={`text-sm text-gray-400 ${className}`}>
      {children}
    </p>
  );
}

export function DialogFooter({ children, className = '' }: DialogFooterProps) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}>
      {children}
    </div>
  );
}
