// Input component
import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-2.5 bg-gray-800 border rounded-xl text-white placeholder-gray-500
            focus:outline-none focus:ring-2 transition-colors
            ${error 
              ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
              : 'border-gray-700 focus:ring-primary/30 focus:border-primary'
            }
            ${className}
          `}
          {...props}
        />
        {(error || helperText) && (
          <p className={`text-xs ${error ? 'text-red-400' : 'text-gray-500'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
