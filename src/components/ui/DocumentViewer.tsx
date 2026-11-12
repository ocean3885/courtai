'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Zoom only the screen preview. The print stylesheet always restores the original document. */
export function DocumentViewer({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const paperWidth = 794;
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setWidth(viewport.current?.clientWidth || 0);
      setHeight(content.current?.offsetHeight || 0);
    });
    if (viewport.current) observer.observe(viewport.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, []);
  const fit = Math.min(1, Math.max(0.1, (width - 24) / paperWidth));
  const scale = zoom ?? fit;
  return (
    <section className="document-viewer min-w-0 rounded-xl border border-slate-200 bg-slate-100" aria-label="문서 미리보기">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3 print:hidden" role="group" aria-label="문서 확대 및 축소">
        <button type="button" className="viewer-button" onClick={() => setZoom(null)} aria-pressed={zoom === null}>화면에 맞추기</button>
        <button type="button" className="viewer-button" aria-label="문서 축소" onClick={() => setZoom(Math.max(0.25, scale - 0.1))} disabled={scale <= 0.25}>−</button>
        <output className="min-w-12 text-center text-sm tabular-nums" aria-live="polite">{Math.round(scale * 100)}%</output>
        <button type="button" className="viewer-button" aria-label="문서 확대" onClick={() => setZoom(Math.min(1.5, scale + 0.1))} disabled={scale >= 1.5}>+</button>
        <button type="button" className="viewer-button" onClick={() => setZoom(1)} aria-pressed={zoom === 1}>100%</button>
        <p className="w-full text-xs text-slate-500">작게 보이면 확대하세요. 확대 후 문서를 좌우로 밀어 확인할 수 있습니다.</p>
      </div>
      <div ref={viewport} className="document-viewport overflow-auto p-3" tabIndex={0} aria-label="확대된 문서 이동 영역">
        <div className="document-scaled-space relative mx-auto" style={{ width: paperWidth * scale, height: height ? height * scale : undefined }}>
          <div ref={content} className="document-scaled-content flow-root origin-top-left" style={{ width: paperWidth, transform: `scale(${scale})` }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
