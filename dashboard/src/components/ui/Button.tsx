// Button component with variants
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'destructive' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'default';
  loading?: boolean;
  icon?: ReactNode;
  isLoading?: boolean;
}

const variantClasses = {
  primary: 'bg-primary hover:bg-primary-dark text-zinc-50',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-zinc-50',
  danger: 'bg-red-600 hover:bg-red-700 text-zinc-50',
  destructive: 'bg-red-600 hover:bg-red-700 text-zinc-50',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-300',
  outline: 'border border-gray-700 bg-transparent hover:bg-gray-800 text-gray-300',
  default: 'bg-primary hover:bg-primary-dark text-zinc-50',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
  icon: 'p-2',
  default: 'px-4 py-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2 font-medium rounded-xl
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          icon
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
