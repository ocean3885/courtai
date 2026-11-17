'use client';

import type { ReactNode } from 'react';

export function FormSection({ index, title, description, summary, issueCount, open, onOpenChange, children }: {
  index: number; title: string; description: string; summary: string; issueCount: number;
  open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode;
}) {
  const id = `cost-section-${index}`;
  return <details id={id} data-cost-section={index} open={open}
    onToggle={event => { if (event.currentTarget.open !== open) onOpenChange(event.currentTarget.open); }}
    className="group/section scroll-mt-24 rounded-xl border border-slate-200 bg-white shadow-sm xl:scroll-mt-64">
    <summary aria-label={`${index + 1}. ${title}`} aria-controls={`${id}-content`} aria-expanded={open}
      className="flex min-h-24 cursor-pointer list-none flex-wrap items-center gap-3 rounded-xl p-4 marker:hidden hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:p-5 [&::-webkit-details-marker]:hidden">
      <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${open ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</span>
      <div className="min-w-0 flex-1"><h2 id={`${id}-title`} className="text-base font-bold text-slate-950 sm:text-lg">{title}</h2><p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{summary}</p></div>
      {issueCount > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">확인 {issueCount}건</span>}
      <span aria-hidden="true" className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500"><span className="hidden sm:inline">{open ? '접기' : '펼치기'}</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className={`h-5 w-5 ${open ? 'rotate-180' : ''}`}><path d="m5 7.5 5 5 5-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
    </summary>
    <div id={`${id}-content`} role="region" aria-labelledby={`${id}-title`} className="space-y-5 border-t border-slate-200 bg-slate-50/60 p-3 sm:p-5"><p className="text-sm leading-relaxed text-slate-500">{description}</p>{children}</div>
  </details>;
}
