import { MainLayout } from '@/components/layout';

import PartyForm from './PartyForm';

export default function LitigationCostsPage() {
  return (
    <MainLayout wide>
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-7">
        <h1 className="text-3xl font-bold">소송비용액확정</h1>
        <p className="my-3 text-sm text-slate-600">
          현재 화면에서 사건 정보를 입력합니다. 새로고침하면 입력 내용이 초기화됩니다.
        </p>
        <div data-case-form>
          <PartyForm />
        </div>
      </div>
    </MainLayout>
  );
}
