const normalizeAmountInput = (value: string) =>
  /^[\d,\s]+$/.test(value) ? value.replace(/[,\s]/g, '') : value;

export const formatAmountInput = (value: string) =>
  /^\d{1,16}$/.test(value) ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : value;

// Store digits only for valid amounts and keep the caret next to the same digit
// when inserting or removing grouping commas during an edit.
export function changeAmountInput(element: HTMLInputElement, change: (value: string) => void) {
  const raw = element.value;
  const value = normalizeAmountInput(raw);
  const formatted = formatAmountInput(value);
  if (formatted !== raw) {
    let digitsBeforeCursor = raw.slice(0, element.selectionStart ?? raw.length).replace(/\D/g, '').length;
    let cursor = 0;
    while (digitsBeforeCursor > 0 && cursor < formatted.length) {
      if (formatted[cursor] !== ',') digitsBeforeCursor--;
      cursor++;
    }
    element.value = formatted;
    element.setSelectionRange(cursor, cursor);
  }
  change(value);
}
