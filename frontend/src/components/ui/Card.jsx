import { cn } from '../../utils/helpers';

export const Card = ({ children, className, hover = false, ...props }) => {
  return (
    <div
      className={cn(
        'bg-card border border-border/50 rounded-sm',
        hover && 'hover:border-primary/50 transition-colors duration-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        'border-b border-border/50 p-4 bg-muted/20',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className, ...props }) => {
  return (
    <h3
      className={cn(
        'font-mono font-bold tracking-tight uppercase text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardContent = ({ children, className, ...props }) => {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
};
