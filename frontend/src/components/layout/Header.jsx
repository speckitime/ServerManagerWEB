import { Bell, Search, Terminal } from 'lucide-react';
import { Input } from '../ui/Input';

export const Header = ({ title }) => {
  return (
    <header
      className="h-16 border-b border-border flex items-center justify-between px-6 sticky top-0 z-30 bg-background/80 backdrop-blur-md"
      data-testid="header"
    >
      <div className="flex items-center gap-4">
        <h1 className="font-mono font-bold text-xl uppercase tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search servers..."
            className="w-64 bg-input border border-border pl-10 pr-4 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            data-testid="header-search"
          />
        </div>
        
        <button
          className="relative p-2 rounded-sm hover:bg-secondary transition-colors"
          data-testid="notifications-btn"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </button>
      </div>
    </header>
  );
};
