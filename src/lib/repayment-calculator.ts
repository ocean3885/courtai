import type { Creditor, RepaymentPlan } from '@/app/case-input/types';
import type { CreditorTotal, RepaymentScheduleRow } from './repayment-plan-service';

export type CalculationCreditor = Pick<Creditor, 'id' | 'number' | 'name' | 'principal'> & Partial<Creditor>;
export type CalculationPlan = Partial<RepaymentPlan>;

function amount(value: unknown): number {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('금액은 0 이상의 안전한 정수여야 합니다.');
  return number;
}

export function getRepaymentCount(plan: CalculationPlan): number {
  const months = plan.repaymentPeriod?.months ?? 36;
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error('변제기간은 1~120개월이어야 합니다.');
  }
  if (plan.repaymentCount && plan.repaymentCount !== months) {
    throw new Error('변제 횟수와 변제기간이 일치해야 합니다.');
  }
  return months;
}

export function flattenCreditors(input: CalculationCreditor[]): CalculationCreditor[] {
  return input.flatMap(c => {
    const subs = c.subrogatedList?.length ? c.subrogatedList :
      (c.isSubrogated && c.subrogationData ? [c.subrogationData] : []);
    return [c, ...subs.map(sub => ({ ...sub, isSecured: false, isPreferential: false }))];
  });
}

/** Allocate once per round, preserving original debt ratios and limiting every payment to the balance. */
export function calculateSchedule(
  creditors: CalculationCreditor[], budgets: number[]
): { schedule: RepaymentScheduleRow[]; creditorTotals: CreditorTotal[] } {
  const balances = new Map<string, number>();
  const totals = new Map<string, CreditorTotal>();
  for (const c of creditors) {
    if (!c.id || balances.has(c.id)) throw new Error('채권자 ID는 중복될 수 없습니다.');
    if (c.isSecured && !c.securedData) throw new Error('별제권부 채권의 상세 정보가 필요합니다.');
    const debt = amount(c.isSecured ? c.securedData?.unrepayableAmount : c.principal);
    balances.set(c.id, debt);
    totals.set(c.id, { creditorId: c.id, creditorNumber: c.number, creditorName: c.name,
      totalDebt: debt, totalPayment: 0, repaymentRate: 0 });
  }
  if (!Number.isSafeInteger([...balances.values()].reduce((a, b) => a + b, 0))) {
    throw new Error('총 채권액이 계산 가능한 범위를 초과했습니다.');
  }
  function distribute(group: CalculationCreditor[], budget: number, payments: Record<string, number>): number {
    let remaining = Math.min(budget, group.reduce((sum, c) => sum + balances.get(c.id)!, 0));
    const initial = remaining;
    while (remaining > 0) {
      const active = group.filter(c => balances.get(c.id)! > 0);
      if (!active.length) break;
      const weight = active.reduce((sum, c) => sum + totals.get(c.id)!.totalDebt, 0);
      const pool = remaining;
      let allocated = 0;
      for (const c of active) {
        const share = Math.min(balances.get(c.id)!, Number(BigInt(pool) * BigInt(totals.get(c.id)!.totalDebt) / BigInt(weight)));
        balances.set(c.id, balances.get(c.id)! - share);
        payments[c.id] = (payments[c.id] || 0) + share;
        allocated += share;
      }
      remaining -= allocated;
      // Resolve integer remainders in a stable order, giving the last creditor first priority.
      for (const c of [...active].reverse()) {
        if (remaining <= 0) break;
        if (balances.get(c.id)! > 0) {
          balances.set(c.id, balances.get(c.id)! - 1);
          payments[c.id] = (payments[c.id] || 0) + 1;
          remaining--;
        }
      }
    }
    return initial;
  }
  const schedule = budgets.map((value, index) => {
    const budget = amount(value);
    const payments: Record<string, number> = Object.create(null);
    const priorityPaid = distribute(creditors.filter(c => c.isPreferential), budget, payments);
    distribute(creditors.filter(c => !c.isPreferential), budget - priorityPaid, payments);
    for (const [id, payment] of Object.entries(payments)) totals.get(id)!.totalPayment += payment;
    return { round: index + 1, payments, total: Object.values(payments).reduce((a, b) => a + b, 0) };
  });
  for (const total of totals.values()) {
    total.repaymentRate = total.totalDebt ? total.totalPayment / total.totalDebt * 100 : 0;
  }
  return { schedule, creditorTotals: [...totals.values()] };
}

export function calculateRepayment(creditors: CalculationCreditor[], plan: CalculationPlan) {
  const count = getRepaymentCount(plan);
  const monthly = amount(plan.monthlyActualAvailableIncome);
  const total = amount(monthly * count);
  const seized = plan.seizedReservesStatus === 'yes' ? amount(plan.seizedReservesAmount) : 0;
  if (seized > total || (seized > 0 && count === 1 && seized !== total)) {
    throw new Error('압류적립금과 변제기간이 총 변제재원에 맞지 않습니다.');
  }
  const budgets = seized > 0 ? [seized, ...Array.from({ length: count - 1 }, (_, i) => {
    const rest = total - seized;
    // Integer distribution preserves the exact total instead of rounding every month upward.
    return Math.floor(rest / (count - 1)) + (i < rest % (count - 1) ? 1 : 0);
  })] : Array(count).fill(monthly);
  return calculateSchedule(flattenCreditors(creditors), budgets);
}
