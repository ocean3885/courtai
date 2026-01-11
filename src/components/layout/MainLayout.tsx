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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      <div className="flex flex-1 relative">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 p-4 md:p-8 w-full">
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
