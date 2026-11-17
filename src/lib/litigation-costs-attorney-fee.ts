/** 변호사보수의 소송비용 산입에 관한 규칙 별표, 2020.12.28. 시행본. */
export type AttorneyFeeInput = {
  schedule: '2020-12-28'; treatment: 'ordinary' | 'half'; litigationValue: string;
};
export type AttorneyFeeCalculation = {
  schedule: '2020-12-28'; treatment: 'ordinary' | 'half'; litigationValue: string;
  grossPaid: string; refund: string; netPaid: string;
  standardExact: { numerator: string; denominator: string }; standardAmount: string;
  limitExact: { numerator: string; denominator: string }; limitAmount: string;
  recognized: string; formula: string[];
};
export type FeeResult = { status: 'ready'; calculation: AttorneyFeeCalculation } | { status: 'blocked'; errors: string[] };
export function isAttorneyFeeInput(value: unknown): value is AttorneyFeeInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return v.schedule === '2020-12-28' && (v.treatment === 'ordinary' || v.treatment === 'half') && typeof v.litigationValue === 'string' && v.litigationValue.length <= 20000;
}
function integer(value: string, label: string): bigint {
  if (typeof value !== 'string' || !/^\d{1,16}$/.test(value) || BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label}: 0 이상의 안전한 정수 금액을 입력하세요.`);
  return BigInt(value);
}
const money = (n: bigint) => n.toLocaleString('ko-KR');
function exact(n: bigint, d: bigint) {
  let a = n, b = d;
  while (b) { const rest = a % b; a = b; b = rest; }
  const divisor = a || BigInt(1);
  return { numerator: String(n / divisor), denominator: String(d / divisor) };
}
export function calculateAttorneyFee(input: AttorneyFeeInput, paid: string, refund = '0'): FeeResult {
  try {
    if (!isAttorneyFeeInput(input)) throw new Error('자동 보수 계산의 적용 별표·사건 유형을 확인하세요.');
    const v = integer(input.litigationValue, '심급별 보수 산정 소가'), gross = integer(paid, '변호사보수 실비'), returned = integer(refund, '보수 환급액');
    if (returned > gross) throw new Error('보수 환급액이 실비보다 큽니다.');
    const net = gross - returned;
    // 상한 / 구간 시작 / 누적 기준액 / 비율(천분율). 경계값은 해당 구간에 포함한다.
    const bands = [
      ['3000000', '0', '300000', '0', ''],
      ['20000000', '3000000', '300000', '100', '10%'],
      ['50000000', '20000000', '2000000', '80', '8%'],
      ['100000000', '50000000', '4400000', '60', '6%'],
      ['150000000', '100000000', '7400000', '40', '4%'],
      ['200000000', '150000000', '9400000', '20', '2%'],
      ['500000000', '200000000', '10400000', '10', '1%'],
      [String(Number.MAX_SAFE_INTEGER), '500000000', '13400000', '5', '0.5%'],
    ];
    const band = bands.find(b => v <= BigInt(b[0]))!;
    const base = BigInt(band[2]), start = BigInt(band[1]), rate = BigInt(band[3]), thousand = BigInt(1000);
    const numerator = base * thousand + (v - start) * rate;
    const standard = numerator / thousand;
    const divisor = thousand * BigInt(input.treatment === 'half' ? 2 : 1);
    const limit = numerator / divisor, recognized = limit < net ? limit : net;
    const baseFormula = rate === BigInt(0) ? `300만원 이하: 300,000원` : `${money(base)} + (${money(v)} − ${money(start)}) × ${band[4]}`;
    const formula = [
      `별표(2020.12.28.): ${baseFormula}${rate ? ` = ${money(standard)}원` : ''}${numerator % thousand ? ' (원 미만 버림)' : ''}`,
    ];
    if (input.treatment === 'half') formula.push(`제5조 1/2 적용: 별표 정밀 기준액 × 1/2 = ${money(limit)}원${numerator % divisor ? ' (원 미만 버림)' : ''}`);
    formula.push(returned ? `실비 ${money(gross)} − 환급 ${money(returned)} = ${money(net)}원` : `실비: ${money(net)}원`);
    formula.push(`산입액 = min(규칙상 ${money(limit)}, 실비 ${money(net)}) = ${money(recognized)}원`);
    return { status: 'ready', calculation: {
      schedule: input.schedule, treatment: input.treatment, litigationValue: String(v), grossPaid: String(gross), refund: String(returned), netPaid: String(net),
      standardExact: exact(numerator, thousand), standardAmount: String(standard), limitExact: exact(numerator, divisor), limitAmount: String(limit), recognized: String(recognized), formula,
    } };
  } catch (error) { return { status: 'blocked', errors: [error instanceof Error ? error.message : '변호사보수 입력을 확인하세요.'] }; }
}

type RecognizableCost = { kind: string; claimed: string; refund: string; recognized: string; attorneyFee?: AttorneyFeeInput };
export type CostRecognition = { status: 'ready'; recognized: string; attorneyFee?: AttorneyFeeCalculation } | { status: 'blocked'; errors: string[] };
/** 화면·검토·배분·출력이 같은 인정액을 사용한다. 저장된 수동 인정액은 덮어쓰지 않는다. */
export function getCostRecognition(cost: RecognizableCost): CostRecognition {
  if (cost.attorneyFee) {
    if (cost.kind !== '변호사보수') return { status: 'blocked', errors: ['변호사보수 외 비용에 자동 보수 설정이 연결되어 있습니다.'] };
    const result = calculateAttorneyFee(cost.attorneyFee, cost.claimed, cost.refund);
    return result.status === 'ready' ? { status: 'ready', recognized: result.calculation.recognized, attorneyFee: result.calculation } : result;
  }
  try { return { status: 'ready', recognized: String(integer(cost.recognized, '직원 인정액')) }; }
  catch (error) { return { status: 'blocked', errors: [error instanceof Error ? error.message : '직원 인정액을 확인하세요.'] }; }
}

/** 같은 심급·중복 귀속 범위의 보수를 행마다 따로 상한 계산하여 이중 산입하지 않는다. */
export function findAutoFeeConflict(costs: (RecognizableCost & { id: string; title: string; stageId: string; payerIds: string[] })[]): string | undefined {
  for (const cost of costs.filter(c => c.attorneyFee)) {
    if (costs.some(other => other.id !== cost.id && other.kind === '변호사보수' && other.stageId === cost.stageId && other.payerIds.some(id => cost.payerIds.includes(id)))) {
      return `${cost.title || '변호사보수'}: 같은 심급·귀속 당사자의 보수가 여러 항목에 나뉘어 있습니다. 자동 한도의 중복 적용을 막기 위해 실비를 한 항목에 합산하거나 수동 검토로 처리하세요.`;
    }
  }
}
