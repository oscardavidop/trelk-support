// Select component
import { forwardRef, type SelectHTMLAttributes } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  options: SelectOption[];
  error?: string;
  onChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, onChange, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          onChange={(e) => onChange?.(e.target.value)}
          className={`
            w-full px-4 py-2.5 bg-gray-800 border rounded-xl text-white
            focus:outline-none focus:ring-2 transition-colors appearance-none
            ${error 
              ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500' 
              : 'border-gray-700 focus:ring-primary/30 focus:border-primary'
            }
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
