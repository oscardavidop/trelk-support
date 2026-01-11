/**
 * Textarea Component
 */

import * as React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`flex min-h-[80px] w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
