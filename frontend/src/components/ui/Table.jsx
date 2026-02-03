import { cn } from '../../utils/helpers';

export const Table = ({ children, className, ...props }) => {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn('w-full data-table', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ children, className, ...props }) => {
  return (
    <thead className={cn('bg-muted/30', className)} {...props}>
      {children}
    </thead>
  );
};

export const TableBody = ({ children, className, ...props }) => {
  return (
    <tbody className={cn('', className)} {...props}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ children, className, ...props }) => {
  return (
    <tr
      className={cn('border-b border-border/30', className)}
      {...props}
    >
      {children}
    </tr>
  );
};

export const TableHead = ({ children, className, ...props }) => {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
};

export const TableCell = ({ children, className, ...props }) => {
  return (
    <td
      className={cn('px-4 py-3 text-sm', className)}
      {...props}
    >
      {children}
    </td>
  );
};
