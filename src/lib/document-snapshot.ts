import { enrichDocumentData, generateDocumentHTML, type DocumentData } from './document-service';
import { generateRepaymentPlanHTML } from './repayment-plan-service';

export interface RenderedDocuments {
  version: 1;
  creditorListHtml: string;
  repaymentPlanHtml: string;
}

export function createDocumentSnapshot(title: string, data: DocumentData) {
  const snapshot = enrichDocumentData(data);
  const rendered: RenderedDocuments = {
    version: 1,
    creditorListHtml: generateDocumentHTML(title, snapshot),
    repaymentPlanHtml: generateRepaymentPlanHTML(snapshot),
  };
  return { snapshot, rendered };
}

/** Only server-produced renderings from html_preview are trusted; never accept HTML from case input. */
export function readRenderedDocuments(value: string): RenderedDocuments | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 1 &&
      'creditorListHtml' in parsed && typeof parsed.creditorListHtml === 'string' &&
      'repaymentPlanHtml' in parsed && typeof parsed.repaymentPlanHtml === 'string') return parsed as RenderedDocuments;
  } catch { /* Legacy documents contained either an empty string or HTML. */ }
  return null;
}
