"use client";

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout';
import Link from 'next/link';

type MedianIncome = {
  id: number;
  year: number;
  household_size: number;
  amount: number;
  created_at?: string;
};

// Default form state for 1~6 person households
const INITIAL_AMOUNTS = [
  { size: 1, amount: 0 },
  { size: 2, amount: 0 },
  { size: 3, amount: 0 },
  { size: 4, amount: 0 },
  { size: 5, amount: 0 },
  { size: 6, amount: 0 },
];

export default function AdminMedianIncomePage() {
  const [data, setData] = useState<MedianIncome[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk Form State
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());
  const [inputAmounts, setInputAmounts] = useState<{ size: number; amount: number }[]>(INITIAL_AMOUNTS);

  // Edit State (Single Item Edit)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/median-income');
      const json = await res.json();
      if (res.ok) {
        setData(json);
        // Optional: Pre-fill form with latest year's data or just keep it blank?
        // Let's keep it simple as requested.
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Filter out items with 0 amount if needed? Or send all as updates?
      // User might want to set some. Assuming non-zero or just all.
      // Sending all allows correcting to 0 if really needed, but usually not.
      // Let's send all.
      
      const res = await fetch('/api/admin/median-income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            year: targetYear, 
            items: inputAmounts.map(item => ({ household_size: item.size, amount: Number(item.amount) })) 
        }),
      });
      const json = await res.json();
      if (res.ok) {
        // Reset or Keep? Usually better to keep for reference or clear?
        // Let's clear amounts but keep year?
        // setInputAmounts(INITIAL_AMOUNTS.map(i => ({ ...i, amount: 0 }))); 
        alert(`${targetYear}년도 데이터가 등록/수정 되었습니다.`);
        fetchData();
      } else {
        alert(json.error || '등록 실패');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAmountChange = (size: number,    newAmount: string) => {
    const val = Number(newAmount);
    setInputAmounts(prev => prev.map(item => item.size === size ? { ...item, amount: val } : item));
  };
  
  // Also handy: Load existing amounts if available for that year when year changes? 
  // For now, let's just stick to manual entry.

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`/api/admin/median-income?id=${id}`, {
            method: 'DELETE',
        });
        if (res.ok) {
            fetchData();
        } else {
            alert('삭제 실패');
        }
    } catch (err) {
        console.error(err);
    }
  };

  const startEdit = (item: MedianIncome) => {
      setEditingId(item.id);
      setEditAmount(item.amount);
  };

  const cancelEdit = () => {
      setEditingId(null);
  };

  const saveEdit = async (id: number) => {
      try {
          const res = await fetch(`/api/admin/median-income`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, amount: editAmount }),
          });
          if (res.ok) {
              setEditingId(null);
              fetchData();
          } else {
              alert('수정 실패');
          }
      } catch (err) {
          console.error(err);
      }
  };

  // Group data by year for display
  const dataByYear = data.reduce((acc, curr) => {
    if (!acc[curr.year]) acc[curr.year] = [];
    acc[curr.year].push(curr);
    return acc;
  }, {} as Record<number, MedianIncome[]>);

  const years = Object.keys(dataByYear).map(Number).sort((a, b) => b - a);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">기준 중위소득 관리</h1>
            <Link href="/admin/users" className="text-blue-600 hover:text-blue-800">
             사용자 관리로 이동
            </Link>
        </div>

        {/* Bulk Registration Form */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
            <h2 className="text-lg font-semibold mb-4 border-b pb-2">연도별 일괄 등록 / 수정</h2>
            <form onSubmit={handleBulkCreate} className="space-y-4">
                <div className="flex items-center gap-4">
                    <label className="text-md font-bold text-gray-700 w-20">연도 설정</label>
                    <input 
                        type="number" 
                        value={targetYear} 
                        onChange={(e) => setTargetYear(Number(e.target.value))}
                        className="border rounded px-3 py-2 w-32 font-bold text-lg"
                    />
                    <span className="text-sm text-gray-500">* 해당 연도의 데이터가 이미 존재하면 덮어씌워집니다.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                    {inputAmounts.map((item) => (
                        <div key={item.size} className="flex items-center gap-3">
                            <label className="w-20 font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded text-center">
                                {item.size}인 가구
                            </label>
                            <div className="relative flex-1">
                                <input 
                                    type="number" 
                                    value={item.amount || ''} 
                                    onChange={(e) => handleAmountChange(item.size, e.target.value)}
                                    className="border rounded px-3 py-2 w-full text-right pr-8"
                                    placeholder="0"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">원</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-4 flex justify-end">
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-lg font-semibold transition-colors shadow">
                        {targetYear}년도 데이터 일괄 저장
                    </button>
                </div>
            </form>
        </div>

        {/* Data List (Grouped by Year) */}
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-800">등록된 내역</h3>
            
            {loading && <div className="text-center py-4">로딩 중...</div>}
            
            {!loading && years.length === 0 && (
                <div className="text-center py-10 bg-gray-50 rounded text-gray-500">등록된 데이터가 없습니다.</div>
            )}

            {years.map(year => (
                <div key={year} className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                    <div className="bg-gray-100 px-6 py-3 border-b flex justify-between items-center">
                        <span className="font-bold text-lg text-gray-800">{year}년</span>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가구원 수</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">기준 중위소득</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">개별 관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {dataByYear[year].map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                                        {item.household_size}인 가구
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {editingId === item.id ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    value={editAmount} 
                                                    onChange={(e) => setEditAmount(Number(e.target.value))}
                                                    className="border rounded px-2 py-1 w-32 text-right"
                                                />
                                                <span>원</span>
                                            </div>
                                        ) : (
                                            `${item.amount.toLocaleString()}원`
                                        )}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                                        {editingId === item.id ? (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => saveEdit(item.id)} className="text-green-600 hover:text-green-900">저장</button>
                                                <button onClick={cancelEdit} className="text-gray-600 hover:text-gray-900">취소</button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => startEdit(item)} className="text-blue-600 hover:text-blue-900">수정</button>
                                                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">삭제</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
      </div>
    </MainLayout>
  );
}
