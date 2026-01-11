'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  isAdminOnly?: boolean;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
  isAdminOnly?: boolean;
}

const navigation: (NavGroup | NavItem)[] = [
  {
    groupName: '회생인가전',
    items: [
      {
        name: '자동 변환 (One-Click)',
        href: '/rehabilitation/rehabauto',
        icon: '🚀',
      },
      {
        name: '내 사건목록',
        href: '/rehabilitation/results',
        icon: '📁',
      },
    ],
  },
  {
    isAdminOnly: true,
    groupName: '운영자',
    items: [
      {
        name: 'PDF변환',
        href: '/rehabilitation',
        icon: '📄',
        isAdminOnly: true,
      },
      {
        name: '사용자 관리',
        href: '/admin/users',
        icon: '👥',
        isAdminOnly: true,
      },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role === 'ADMIN') {
          setIsAdmin(true);
        }
      })
      .catch(() => setIsAdmin(false));
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

          <nav className="flex-1 overflow-y-auto">
            <ul className="space-y-6">
              {navigation.map((item, index) => {
                if (item.isAdminOnly && !isAdmin) return null;

                if ('groupName' in item) {
                  return (
                    <li key={item.groupName} className="space-y-2">
                      <div className="flex items-center px-4 pt-2">
                        <span className="w-1 h-3 bg-blue-600 rounded-full mr-2"></span>
                        <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider">
                          {item.groupName}
                        </h4>
                      </div>
                      <ul className="space-y-1">
                        {item.items.map((subItem) => {
                          const isActive = pathname?.startsWith(subItem.href);
                          return (
                            <li key={subItem.href}>
                              <Link
                                href={subItem.href}
                                onClick={() => onClose?.()}
                                className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${isActive
                                  ? 'bg-blue-50 text-blue-700 font-semibold'
                                  : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                              >
                                <span className="text-lg">{subItem.icon}</span>
                                <span className="text-sm">{subItem.name}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                }

                // 단일 아이템 (그룹 없는 경우)
                const isActive = pathname?.startsWith(item.href);
                return (
                  <li key={item.href} className="pt-4 mt-4 border-t border-gray-100">
                    <Link
                      href={item.href}
                      onClick={() => onClose?.()}
                      className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm">{item.name}</span>
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
