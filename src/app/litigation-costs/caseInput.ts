export const levels = ['1심', '항소심', '상고심'] as const;
export type Level = (typeof levels)[number];
export type ValueMode = '합산' | '흡수';
export type ValueRelation = ValueMode | '기타';
export type CostClaim = '본소' | '반소' | '공통';
export type ClaimSplit = '소가 비율' | '균분';
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
  counterValue?: string;
  relationValues?: Record<string, string>;
  counterRelationValues?: Record<string, string>;
};
export type DeliveryDetail = {
  incurred?: string;
  decision?: string;
  mobile?: string;
};
export type Cost = {
  application?: {
    useCommon?: boolean;
    ownerWeights?: Record<string, string>;
    opponentIds: string[];
    opponentMethod?: '균분' | '직접 비율';
    opponentWeights?: Record<string, string>;
    rates?: Record<string, Record<string, { n: string; d: string }>>;
  };
  deliveryDetail?: DeliveryDetail;
  id: string;
  payer: string;
  side?: PartySide;
  kind: string;
  paid: string;
  recognized?: string;
  ruleId?: string;
  claim?: CostClaim;
  claimSplit?: ClaimSplit;
  mainRuleId?: string;
  counterRuleId?: string;
  opponentMethod?: '균분' | '안분';
  refund: string;
  shared: boolean;
  ids: string[];
  method: string;
  evidence: string;
  title: string;
};
export type ApplicationPolicy = {
  mode: '판결 기준' | '별도 기준';
  stageId?: string;
  claim?: '본소' | '반소';
  allocation?: Cost['application'];
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
export type RecordedValue = { id: string; side?: PartySide; ids: string[]; amount: string };
export type PartialCounterParties = { counterPlaintiffIds: string[]; counterDefendantIds: string[] };
export type Stage = {
  mainValues?: RecordedValue[];
  counterValues?: RecordedValue[];
  id: string;
  level?: Level;
  valueMode?: ValueMode;
  applicantValueMode?: ValueMode;
  opponentValueMode?: ValueMode;
  applicantValueRelation?: ValueRelation;
  opponentValueRelation?: ValueRelation;
  counterValueRelation?: ValueRelation;
  number: string;
  value: string;
  mainValueTarget?: PartySide;
  useIndividualValues?: boolean;
  members: Record<string, Member>;
  counter: string;
  partialCounter?: PartialCounterParties;
  counterValue: string;
  useCounterIndividualValues?: boolean;
  counterValueMode?: ValueMode;
  counterFeeMode?: ValueMode;
  counterNumber?: string;
  costs: Cost[];
  rules: Rule[];
};

export function stageLevel(s: { level?: string }, index: number): Level {
  if (s.level === '1심' || s.level === '항소심' || s.level === '상고심') return s.level;
  return levels[index] || '1심';
}

export function isApplicantSideParty(p: Party): boolean {
  if (p.side) return p.side === '신청인측';
  return p.group === '신청인';
}
