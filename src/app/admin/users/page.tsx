"use client";

import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout';

type Role = 'ADMIN' | 'USER';

type AdminUser = {
  id: number;
  username: string;
  role: Role;
  created_at: string;
  isInitialAdmin?: boolean;
};

const roleLabels: Record<Role, string> = {
  ADMIN: '관리자',
  USER: '사용자',
};

const roleBadgeClasses: Record<Role, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  USER: 'bg-green-100 text-green-800',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, '사용자 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const stats = useMemo(() => {
    const total = users.length;
    const adminNum = users.filter((u) => u.role === 'ADMIN').length;
    const userNum = users.filter((u) => u.role === 'USER').length;
    return { total, admin: adminNum, user: userNum };
  }, [users]);

  const handleUpdateRole = async (userId: number, role: Role) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '업데이트에 실패했습니다.');
      }
      setSuccess('권한이 업데이트되었습니다.');
      await fetchUsers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, '업데이트에 실패했습니다.'));
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('정말로 이 사용자를 삭제하시겠습니까?')) return;
    
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '삭제에 실패했습니다.');
      }
      setSuccess('사용자가 삭제되었습니다.');
      await fetchUsers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, '삭제에 실패했습니다.'));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">사용자 관리</h1>
            <p className="text-gray-600 mt-2">사용자 권한 관리 및 계정 삭제</p>
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
          <StatCard label="관리자" value={stats.admin} tone="purple" />
          <StatCard label="일반 사용자" value={stats.user} tone="green" />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b">
            <p className="text-sm text-gray-700">전체 사용자 리스트</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <HeaderCell label="아이디" />
                  <HeaderCell label="현재 역할" />
                  <HeaderCell label="역할 변경" />
                  <HeaderCell label="가입일" />
                  <HeaderCell label="관리" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 && !loading && (
                  <tr>
                    <td className="px-6 py-6 text-sm text-gray-500" colSpan={5}>
                      사용자가 없습니다.
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Avatar name={user.username} />
                        <div className="ml-3 font-medium text-gray-900">{user.username}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${roleBadgeClasses[user.role]}`}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value as Role)}
                        disabled={user.isInitialAdmin}
                      >
                        <option value="USER">사용자</option>
                        <option value="ADMIN">관리자</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        className="text-red-600 hover:text-red-900 font-medium disabled:opacity-30"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={user.isInitialAdmin}
                      >
                        삭제
                      </button>
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function HeaderCell({ label }: { label: string }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      {label}
    </th>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name?.slice(0, 1).toUpperCase() || '?';
  return (
    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
      {initials}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'purple' }) {
  const toneMap = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
  };

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
