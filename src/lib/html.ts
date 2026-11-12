export function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

/** Escape input text at the HTML rendering boundary, including names inside income details. */
export function escapeDocumentData<T>(value: T): T {
  if (typeof value === 'string') return escapeHTML(value) as T;
  if (Array.isArray(value)) return value.map(item => escapeDocumentData(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (key === 'monthlyIncomeDetails' && typeof item === 'string' && item.startsWith('{')) {
        try { return [key, JSON.stringify(escapeDocumentData(JSON.parse(item)))]; } catch { /* Treat malformed JSON as text. */ }
      }
      return [key, escapeDocumentData(item)];
    })) as T;
  }
  return value;
}
