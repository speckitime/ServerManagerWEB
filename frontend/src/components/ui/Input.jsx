import { cn } from '../../utils/helpers';

export const Input = ({
  label,
  error,
  className,
  type = 'text',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          {label}
        </label>
      )}
      <input
        type={type}
        className={cn(
          'w-full bg-input border border-border px-4 py-2.5 text-foreground font-mono text-sm',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
          'transition-colors duration-200',
          error && 'border-destructive',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-destructive font-mono">{error}</p>
      )}
    </div>
  );
};

export const Select = ({
  label,
  options,
  error,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          {label}
        </label>
      )}
      <select
        className={cn(
          'w-full bg-input border border-border px-4 py-2.5 text-foreground font-mono text-sm',
          'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
          'transition-colors duration-200',
          error && 'border-destructive',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-destructive font-mono">{error}</p>
      )}
    </div>
  );
};

export const Textarea = ({
  label,
  error,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          'w-full bg-input border border-border px-4 py-2.5 text-foreground font-mono text-sm resize-none',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
          'transition-colors duration-200',
          error && 'border-destructive',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-destructive font-mono">{error}</p>
      )}
    </div>
  );
};
