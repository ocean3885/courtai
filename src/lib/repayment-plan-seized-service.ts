import { calculateRepayment, type CalculationCreditor } from './repayment-calculator';

export function generateRepaymentScheduleWithSeizedReserves(
  creditors: CalculationCreditor[], monthlyActualAvailableIncome: number,
  repaymentCount: number, seizedReservesAmount: number
) {
  return calculateRepayment(creditors, {
    monthlyActualAvailableIncome,
    repaymentPeriod: { months: repaymentCount, startDate: '', endDate: '' },
    seizedReservesStatus: 'yes', seizedReservesAmount,
  });
}
