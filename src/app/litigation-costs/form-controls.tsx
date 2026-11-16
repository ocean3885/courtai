'use client';

import { useId, type ReactNode } from 'react';

export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 focus:outline-2 focus:outline-blue-600';
export const primary = 'rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800';
export const secondary = 'rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50';

export function Field({ label, value, onChange, type = 'text', hint, multiline = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string; multiline?: boolean }) {
  const id = useId();
  return <div className="min-w-0 text-sm text-slate-700"><label htmlFor={id} className="mb-2 block font-medium">{label}</label>
    {multiline ? <textarea id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={inputClass} rows={3} value={value} onChange={e => onChange(e.target.value)} maxLength={20000} />
      : <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={inputClass} type={type === 'money' ? 'text' : type} inputMode={type === 'money' ? 'numeric' : undefined} value={value} onChange={e => onChange(e.target.value)} maxLength={20000} />}
    {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs font-normal leading-relaxed text-slate-500">{hint}</p>}
  </div>;
}
export function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const id = useId();
  return <div className="min-w-0 text-sm font-medium text-slate-700"><label htmlFor={id} className="mb-2 block">{label}</label><select id={id} className={inputClass} value={value} onChange={e => onChange(e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select></div>;
}
export function Multi({ label, items, selected, onChange }: { label: string; items: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className="min-w-0"><legend className="mb-2 text-sm font-medium text-slate-700">{label}</legend>
    {items.length ? <div className="flex flex-wrap gap-2">{items.map(x => <label key={x.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${selected.includes(x.id) ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-600'}`}>
      <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={selected.includes(x.id)} onChange={e => onChange(e.target.checked ? [...selected, x.id] : selected.filter(id => id !== x.id))} />{x.name || '이름 미입력'}</label>)}</div>
      : <p className="text-sm text-slate-500">앞 단계에서 대상을 먼저 등록하세요.</p>}
  </fieldset>;
}
export function Panel({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">{title}</h2>{description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>}</div>{action}</div>{children}</section>;
}
export function Empty({ children }: { children: ReactNode }) { return <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">{children}</p>; }
