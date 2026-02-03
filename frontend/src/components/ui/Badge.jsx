import { cn } from '../../utils/helpers';

export const Badge = ({ children, variant = 'default', className, ...props }) => {
  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-online/20 text-online',
    danger: 'bg-destructive/20 text-destructive',
    warning: 'bg-warning/20 text-warning',
    info: 'bg-maintenance/20 text-maintenance'
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
