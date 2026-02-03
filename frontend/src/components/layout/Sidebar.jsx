import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  ListTodo,
  Users,
  Network,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Terminal,
  Bell
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../utils/helpers';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Server, label: 'Servers', path: '/servers' },
  { icon: ListTodo, label: 'Tasks', path: '/tasks' },
  { icon: Bell, label: 'Alerts', path: '/alerts' },
  { icon: Network, label: 'IP Overview', path: '/ip-overview' },
  { icon: Users, label: 'Users', path: '/users', adminOnly: true },
  { icon: Settings, label: 'Settings', path: '/settings' }
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-background/95 backdrop-blur border-r border-border z-40',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Terminal className="w-6 h-6 text-primary glow-green" />
            <span className="font-mono font-bold text-lg tracking-tight">
              NEXUS<span className="text-primary">CMD</span>
            </span>
          </div>
        )}
        {collapsed && (
          <Terminal className="w-6 h-6 text-primary glow-green mx-auto" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors duration-200',
                    'hover:bg-primary/10',
                    isActive && 'bg-primary/15 border-l-2 border-primary text-primary'
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                  {!collapsed && (
                    <span className={cn(
                      'font-mono text-xs uppercase tracking-wider',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-border p-4">
        {!collapsed && (
          <div className="mb-4">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              {user?.username}
            </p>
            <p className="font-mono text-[0.65rem] text-muted-foreground/60">
              {user?.role}
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={logout}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-sm transition-colors duration-200',
              'hover:bg-destructive/10 text-muted-foreground hover:text-destructive',
              collapsed && 'w-full justify-center'
            )}
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && (
              <span className="font-mono text-xs uppercase tracking-wider">Logout</span>
            )}
          </button>
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-sm hover:bg-secondary transition-colors"
            data-testid="collapse-sidebar-btn"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
