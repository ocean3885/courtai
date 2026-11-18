import { MainLayout } from '@/components/layout';

import PartyForm from './PartyForm';

export default function LitigationCostsPage() {
  return (
    <MainLayout wide>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold text-slate-900">소송비용액확정</h1>
          <p className="text-sm text-slate-600">
            현재 화면에서 사건 정보를 입력합니다. 새로고침하면 입력 내용이 초기화됩니다.
          </p>
        </div>
        <div data-case-form>
          <PartyForm />
        </div>
      </div>
    </MainLayout>
  );
}
