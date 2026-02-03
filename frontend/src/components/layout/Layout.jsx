import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '../../utils/helpers';

export const Layout = ({ children, title = 'Dashboard' }) => {
  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Sidebar />
      <main className="ml-64 min-h-screen transition-all duration-300">
        <Header title={title} />
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
