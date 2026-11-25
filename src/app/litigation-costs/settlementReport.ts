import { add, nothing, type Amount, type CalculationStep } from './costReview';
import { type LitigationCalculation } from './litigationCalculation';

type Calculation = Pick<LitigationCalculation, 'main' | 'application' | 'settlements'>;
type FormulaLine = { amount: Amount; steps: CalculationStep[]; stageId?: string; order?: string; basis?: string };
const number = (value: bigint) => value.toLocaleString('ko-KR');
const exact = (value: Amount) => value.d === BigInt(1) ? number(value.n) : `${number(value.n)}/${number(value.d)}`;

// Combine original amounts only when the complete allocation path agrees.
// Keep exact fractions and leave truncation to the settlement engine.
function expression(lines: FormulaLine[]): string {
  const groups = new Map<string, { base: Amount; steps: CalculationStep[] }>();
  for (const line of lines) {
    if (line.amount.n === BigInt(0)) continue;
    const key = JSON.stringify([line.stageId, line.order, line.basis,
      line.steps.map(step => [step.label, String(step.factor.n), String(step.factor.d)])]);
    const group = groups.get(key) || { base: nothing, steps: line.steps };
    group.base = add(group.base, line.steps[0]?.input ?? line.amount);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ base, steps }) => [
    base.d === BigInt(1) ? exact(base) : `(${exact(base)})`,
    ...steps.map(step => exact(step.factor)),
  ].join(' × ')).join(' + ');
}

export function settlementFormula(row: Calculation['settlements'][number], calculation: Calculation): string {
  const forward = expression(calculation.main.lines.filter(line => line.owner === row.a.id && line.debtor === row.b.id));
  const reverse = expression(calculation.main.lines.filter(line => line.owner === row.b.id && line.debtor === row.a.id));
  const application = expression(calculation.application.lines.filter(line => line.owner === row.a.id && line.debtor === row.b.id));
  let formula = forward || '0';
  if (reverse) formula += ` − ${reverse.includes(' + ') ? `(${reverse})` : reverse}`;
  if (application) formula += ` + ${application}`;
  return row.negative ? `−(${formula})` : formula;
}

export function buildSettlementReport(calculation: Calculation) {
  const groups: { rows: Calculation['settlements']; formula: string }[] = [];
  const keys = new Map<string, number>();
  for (const row of calculation.settlements) {
    const formula = row.missing ? '' : settlementFormula(row, calculation);
    const key = row.missing || row.payable.n === BigInt(0)
      ? JSON.stringify([row.a.id, row.b.id])
      : JSON.stringify([row.payer.id, row.negative, String(row.payable.n), formula,
        [row.forward, row.reverse, row.applicationAmount].map(value => [String(value.n), String(value.d)])]);
    const index = keys.get(key);
    if (index === undefined) {
      keys.set(key, groups.length);
      groups.push({ rows: [row], formula });
    } else {
      groups[index].rows.push(row);
    }
  }
  return groups;
}
