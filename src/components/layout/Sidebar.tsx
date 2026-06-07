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
    groupName: '홈',
    items: [
      {
        name: '업무 홈',
        href: '/',
        icon: 'home',
      },
      {
        name: '최근 작업',
        href: '/case-list',
        icon: 'clock',
      },
    ],
  },
  {
    groupName: '서비스',
    items: [
      {
        name: '개인회생 서류 작성',
        href: '/case-input',
        icon: 'document',
      },
      {
        name: '소송비용액 확정 계산',
        href: '/case-list',
        icon: 'calculator',
      },
    ],
  },
  {
    groupName: '지원',
    items: [
      {
        name: '문의하기',
        href: '/inquiry',
        icon: 'help',
      },
    ],
  },
  {
    isAdminOnly: true,
    groupName: '관리자',
    items: [
      {
        name: '사용자 관리',
        href: '/admin/users',
        icon: 'users',
        isAdminOnly: true,
      },
      {
        name: '문의 확인',
        href: '/admin/inquiries',
        icon: 'mail',
        isAdminOnly: true,
      },
    ],
  },
];

function NavIcon({ name }: { name: string }) {
  const common = {
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.9,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'home':
      return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'document':
      return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5" /><path d="M9.5 13h5" /><path d="M9.5 17h4" /></svg>;
    case 'calculator':
      return <svg {...common}><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M8.5 7h7" /><path d="M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M9 18h.01M12 18h.01M15 18h.01" /></svg>;
    case 'automation':
      return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5" /><path d="m10 14 2 2 4-5" /></svg>;
    case 'folder':
      return <svg {...common}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /></svg>;
    case 'help':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.6 2.6 0 0 1 5 1c0 2-2.5 2.2-2.5 4" /><path d="M12 17h.01" /></svg>;
    case 'users':
      return <svg {...common}><path d="M16 20c0-2.2-1.8-4-4-4s-4 1.8-4 4" /><circle cx="12" cy="9" r="3" /><path d="M21 20c0-1.7-1-3.1-2.5-3.7" /><path d="M17 6.3a3 3 0 0 1 0 5.4" /></svg>;
    case 'mail':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
    default:
      return <span className="text-base">{name}</span>;
  }
}

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
          fixed inset-y-0 left-0 z-50 w-[230px] transform border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out
          md:sticky md:top-0 md:translate-x-0 md:self-start md:min-h-screen
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full min-h-screen flex-col p-5">
          <Link href="/" onClick={() => onClose?.()} className="mb-9 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
              CE
            </span>
            <span className="text-lg font-bold text-slate-950">Court-Easy</span>
          </Link>

          {/* Mobile Close Button */}
          <div className="absolute right-3 top-3 md:hidden">
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="메뉴 닫기"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto">
            <ul className="space-y-7">
              {navigation.map((item) => {
                if (item.isAdminOnly && !isAdmin) return null;

                if ('groupName' in item) {
                  return (
                    <li key={item.groupName} className="space-y-2">
                      <div className="px-1">
                        <h4 className="text-sm font-semibold text-slate-700">
                          {item.groupName}
                        </h4>
                      </div>
                      <ul className="space-y-1">
                        {item.items.map((subItem) => {
                          const isActive = subItem.href === '/' ? pathname === '/' : pathname?.startsWith(subItem.href);
                          return (
                            <li key={subItem.href}>
                              <Link
                                href={subItem.href}
                                onClick={() => onClose?.()}
                                className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive
                                  ? 'bg-blue-50 text-blue-700 font-semibold'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                                  }`}
                              >
                                <NavIcon name={subItem.icon} />
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
                const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
                return (
                  <li key={item.href} className="border-t border-slate-100 pt-4">
                    <Link
                      href={item.href}
                      onClick={() => onClose?.()}
                      className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                        }`}
                    >
                      <NavIcon name={item.icon} />
                      <span className="text-sm">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            className="mt-8 flex h-11 items-center gap-3 border-t border-slate-200 pt-5 text-sm font-medium text-slate-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m11 17-5-5 5-5" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m18 17-5-5 5-5" />
            </svg>
            메뉴 접기
          </button>
        </div>
      </aside>
    </>
  );
}
