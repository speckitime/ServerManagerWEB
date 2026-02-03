import { useState } from 'react';
import { cn } from '../../utils/helpers';

export const Tabs = ({ children, defaultValue, className }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  return (
    <div className={cn('', className)}>
      {typeof children === 'function' 
        ? children({ activeTab, setActiveTab })
        : children
      }
    </div>
  );
};

export const TabsList = ({ children, className }) => {
  return (
    <div className={cn('flex border-b border-border', className)}>
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, activeTab, setActiveTab, children, className }) => {
  const isActive = activeTab === value;
  
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'px-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors duration-200',
        'hover:text-foreground',
        isActive 
          ? 'text-primary border-b-2 border-primary -mb-px' 
          : 'text-muted-foreground',
        className
      )}
      data-testid={`tab-${value}`}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, activeTab, children, className }) => {
  if (activeTab !== value) return null;
  
  return (
    <div className={cn('py-4 animate-fade-in', className)}>
      {children}
    </div>
  );
};
