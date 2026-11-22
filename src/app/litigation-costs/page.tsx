import { MainLayout } from '@/components/layout';

import PartyForm from './PartyForm';

export default function LitigationCostsPage() {
  return (
    <MainLayout wide>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold text-slate-900">소송비용액확정</h1>
          <p className="text-sm text-slate-600">
            사건 자료를 입력하고 로그인한 계정에 저장할 수 있습니다.
          </p>
        </div>
        <div data-case-form>
          <PartyForm />
        </div>
      </div>
    </MainLayout>
  );
}
