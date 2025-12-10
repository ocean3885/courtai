"use client";

import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout';

type Role = 'ADMIN' | 'OPERATOR' | 'USER' | 'PENDING';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  court: string | null;
  department: string | null;
  position: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

const roleLabels: Record<Role, string> = {
  ADMIN: '관리자',
  OPERATOR: '운영자',
  USER: '사용자',
  PENDING: '승인 대기',
};

const roleBadgeClasses: Record<Role, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  OPERATOR: 'bg-blue-100 text-blue-800',
  USER: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

const statusBadge = (isActive: boolean) =>
  isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, 'USER' | 'OPERATOR'>>({});

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '사용자 목록을 불러오지 못했습니다.');
      }
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || '사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const pendingUsers = useMemo(() => users.filter((u) => u.role === 'PENDING'), [users]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const pending = pendingUsers.length;
    return { total, active, pending };
  }, [users, pendingUsers]);

  const handleApprove = async (userId: string) => {
    const role = roleDrafts[userId] || 'USER';
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role, isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '승인에 실패했습니다.');
      }
      setSuccess('권한이 업데이트되었습니다.');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || '승인에 실패했습니다.');
    }
  };

  const handleRoleChange = (userId: string, role: 'USER' | 'OPERATOR') => {
    setRoleDrafts((prev) => ({ ...prev, [userId]: role }));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">사용자 관리</h1>
            <p className="text-gray-600 mt-2">회원가입 신청자 승인 및 권한 부여</p>
          </div>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            새로고침
          </button>
        </div>

        {(error || success) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-green-200 bg-green-50 text-green-800'
            }`}
          >
            {error || success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="전체 사용자" value={stats.total} tone="blue" />
          <StatCard label="활성 사용자" value={stats.active} tone="green" />
          <StatCard label="승인 대기" value={stats.pending} tone="yellow" />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">승인 대기 사용자</p>
              <p className="text-xs text-gray-500">ADMIN만 접근 가능 · USER/OPERATOR 권한 부여</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <HeaderCell label="사용자" />
                  <HeaderCell label="이메일" />
                  <HeaderCell label="부서/직급" />
                  <HeaderCell label="신청 역할" />
                  <HeaderCell label="가입일" />
                  <HeaderCell label="관리" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingUsers.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-sm text-gray-500" colSpan={6}>
                      승인 대기 사용자가 없습니다.
                    </td>
                  </tr>
                )}
                {pendingUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Avatar name={user.name} />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.court || '소속 미입력'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {user.department || '-'} / {user.position || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={roleDrafts[user.id] || 'USER'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as 'USER' | 'OPERATOR')}
                      >
                        <option value="USER">일반 사용자</option>
                        <option value="OPERATOR">운영자</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        onClick={() => handleApprove(user.id)}
                        disabled={loading}
                      >
                        승인 & 권한 부여
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b">
            <p className="text-sm text-gray-700">전체 사용자 현황</p>
            <p className="text-xs text-gray-500">역할/상태 확인용</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <HeaderCell label="사용자" />
                  <HeaderCell label="이메일" />
                  <HeaderCell label="부서/직급" />
                  <HeaderCell label="역할" />
                  <HeaderCell label="상태" />
                  <HeaderCell label="가입일" />
                  <HeaderCell label="최근 로그인" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-sm text-gray-500" colSpan={7}>
                      사용자 정보가 없습니다.
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Avatar name={user.name} />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.court || '소속 미입력'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {user.department || '-'} / {user.position || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${roleBadgeClasses[user.role]}`}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${statusBadge(user.is_active)}`}>
                        {user.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function HeaderCell({ label }: { label: string }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      {label}
    </th>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name?.slice(0, 1) || '?';
  return (
    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
      {initials}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'yellow' }) {
  const toneMap: Record<typeof tone, string> = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  } as const;

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <span className="text-xl">👥</span>
        </div>
      </div>
    </div>
  );
}
