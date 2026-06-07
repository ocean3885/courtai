'use client';

import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

interface MainLayoutProps {
  children: React.ReactNode;
  wide?: boolean;
}

export function MainLayout({ children, wide }: MainLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col bg-white">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 border-l border-slate-200 bg-white">
            <div className={`${wide ? 'max-w-none' : 'max-w-7xl'} mx-auto w-full`}>
              {children}
            </div>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
