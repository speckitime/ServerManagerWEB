import { cn } from '../../utils/helpers';

export const ProgressBar = ({ value, max = 100, className, showLabel = true, color = 'primary' }) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const colors = {
    primary: 'bg-primary',
    danger: 'bg-destructive',
    warning: 'bg-warning',
    success: 'bg-online'
  };
  
  // Determine color based on percentage
  const getAutoColor = () => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 75) return 'bg-warning';
    return 'bg-primary';
  };
  
  return (
    <div className={cn('', className)}>
      <div className="progress-bar h-2 rounded-sm">
        <div
          className={cn(
            'progress-fill h-full rounded-sm',
            color === 'auto' ? getAutoColor() : colors[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          {percentage.toFixed(1)}%
        </p>
      )}
    </div>
  );
};
