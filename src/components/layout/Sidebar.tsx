'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  requiredPermission?: string;
}

const navigationItems: NavItem[] = [
  {
    name: '대시보드',
    href: '/dashboard',
    icon: '📊',
  },
  {
    name: '기타집행',
    href: '/execution',
    icon: '⚖️',
  },
  {
    name: '사용자 관리',
    href: '/admin/users',
    icon: '👥',
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    const checkAdmin = async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'ADMIN') {
          setIsAdmin(true);
        }
      }
    };

    checkAdmin();
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out
          md:static md:translate-x-0 md:min-h-[calc(100vh-73px)]
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4 flex flex-col h-full">
          {/* Mobile Close Button */}
          <div className="md:hidden flex justify-end mb-4">
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1">
            <ul className="space-y-2">
              {navigationItems.map((item) => {
                // 사용자 관리 메뉴는 ADMIN만 볼 수 있음
                if (item.href === '/admin/users' && !isAdmin) {
                  return null;
                }

                const isActive = pathname?.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => onClose?.()} // 모바일에서 클릭 시 닫기
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
