// Toggle switch component
interface ToggleProps {
  enabled?: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  checked?: boolean;
}

export function Toggle({ enabled, onChange, label, description, disabled = false }: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      {(label || description) && (
        <div className="flex-1 mr-4">
          {label && <p className="text-sm font-medium text-white">{label}</p>}
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => !disabled && onChange(!enabled)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${enabled ? 'bg-primary' : 'bg-gray-700'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}
