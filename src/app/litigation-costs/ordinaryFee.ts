// 변호사보수의 소송비용 산입에 관한 규칙 별표 (2020.12.28.).
// 기준 소가, 해당 소가의 보수, 초과분에 곱할 천분율.
const brackets = [
  [500000000, 13400000, 5],
  [200000000, 10400000, 10],
  [150000000, 9400000, 20],
  [100000000, 7400000, 40],
  [50000000, 4400000, 60],
  [20000000, 2000000, 80],
  [3000000, 300000, 100],
] as const;

export function ordinaryFeeLimit(value: bigint): bigint {
  for (const [start, base, rate] of brackets) {
    if (value > start) {
      return BigInt(base) + ((value - BigInt(start)) * BigInt(rate)) / BigInt(1000);
    }
  }
  return BigInt(300000);
}
