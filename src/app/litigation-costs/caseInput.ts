export const levels = ['1심', '항소심', '상고심'] as const;
export type Level = (typeof levels)[number];
export type ValueMode = '합산' | '흡수';
export type MemberValueType = '개별' | '공통' | '공통2' | '흡수';
export type Group = '신청인' | '피신청인' | '신청외';
export type PartySide = '신청인측' | '피신청인측';
export type Party = { id: string; group: Group; side?: PartySide; name: string };
export type Member = {
  role: string;
  number: string;
  value: string;
  valueType?: MemberValueType;
  counterRole: string;
};
export type Cost = {
  id: string;
  payer: string;
  side?: PartySide;
  kind: string;
  paid: string;
  recognized?: string;
  ruleId?: string;
  refund: string;
  shared: boolean;
  ids: string[];
  method: string;
  evidence: string;
  title: string;
};
export type Rule = {
  id: string;
  left: string[];
  right: string[];
  mode: string;
  n: string;
  d: string;
  scope: string;
  claim: string;
  leftMethod: string;
  rightMethod: string;
};
export type RecordedValue = { id: string; ids: string[]; amount: string };
export type Stage = {
  mainValues?: RecordedValue[];
  counterValues?: RecordedValue[];
  id: string;
  level?: Level;
  valueMode?: ValueMode;
  applicantValueMode?: ValueMode;
  opponentValueMode?: ValueMode;
  number: string;
  value: string;
  members: Record<string, Member>;
  counter: string;
  counterValue: string;
  counterNumber?: string;
  costs: Cost[];
  rules: Rule[];
};
export type Reviews = Record<string, { submission?: string; treatment?: string; zeroConfirmed?: boolean }>;

export function stageLevel(s: { level?: string }, index: number): Level {
  if (s.level === '1심' || s.level === '항소심' || s.level === '상고심') return s.level;
  return levels[index] || '1심';
}

export function isApplicantSideParty(p: Party): boolean {
  if (p.side) return p.side === '신청인측';
  return p.group === '신청인';
}
