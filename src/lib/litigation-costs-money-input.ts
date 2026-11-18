/** Strict money parsing shared by quick-entry forms. Empty is unknown unless explicitly optional. */
export type MoneyInputResult = { status: 'ready'; amount: string } | { status: 'blocked'; error: string };
export const safeMoneyInteger = (value: string) => /^\d{1,16}$/.test(value) && BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER);
export function sumMoneyInputs(values: string[], optionalBlank = false): MoneyInputResult {
  if (!values.length || (optionalBlank && values.every(v => !v))) return { status: 'blocked', error: '금액을 입력하세요. 미확인 금액은 0원으로 계산하지 않습니다.' };
  if (values.some(v => !(optionalBlank && v === '') && !safeMoneyInteger(v))) return { status: 'blocked', error: '각 금액을 0 이상의 안전한 정수로 입력하세요. 사용하지 않는 항목은 0원을 입력합니다.' };
  const total = values.reduce((sum, v) => sum + BigInt(v || '0'), BigInt(0));
  return total > BigInt(Number.MAX_SAFE_INTEGER)
    ? { status: 'blocked', error: '금액 합계가 안전한 정수 범위를 초과합니다.' }
    : { status: 'ready', amount: String(total) };
}
export function netMoneyInput(paid: string, refund: string): MoneyInputResult {
  if (!safeMoneyInteger(paid) || !safeMoneyInteger(refund)) return { status: 'blocked', error: '납부액과 환급액을 0 이상의 안전한 정수로 입력하세요. 환급이 없으면 0원을 입력합니다.' };
  if (BigInt(refund) > BigInt(paid)) return { status: 'blocked', error: '환급액이 납부액을 초과합니다.' };
  return { status: 'ready', amount: String(BigInt(paid) - BigInt(refund)) };
}

export function allocationWeightInput(primary: string, preliminary: string, absorbed: string): MoneyInputResult & { gross?: string } {
  const gross = sumMoneyInputs([primary, preliminary], true);
  if (gross.status === 'blocked') return gross;
  const net = netMoneyInput(gross.amount, absorbed || '0');
  return net.status === 'ready' ? { ...net, gross: gross.amount } : net;
}
