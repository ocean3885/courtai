import { isApplicantSideParty, type Party, type Stage } from './caseInput';

export function relationOpponents(stage: Stage, party: Party, parties: Party[]): Party[] {
  return parties.filter(p => stage.members[p.id] && isApplicantSideParty(p) !== isApplicantSideParty(party));
}

export function relationValueIssue(values: Record<string, string>, opponentIds: string[], total: string): string {
  if (!/^\d{1,16}$/.test(total)) return '개별소가를 먼저 입력하세요.';
  if (opponentIds.some(id => !/^\d{1,16}$/.test(values[id] ?? '')))
    return '상대방별 소가를 모두 입력하세요. 해당 금액이 없으면 0원을 입력하세요.';
  const sum = opponentIds.reduce((sum, id) => sum + BigInt(values[id]), BigInt(0));
  if (sum !== BigInt(total)) return '관계별 소가 합계가 해당 당사자의 개별소가와 같아야 합니다.';
  return '';
}

export function relationAmounts(stage: Stage, parties: Party[], owner: string, ids: string[], counter: boolean): bigint[] | null {
  const enabled = counter ? stage.useCounterIndividualValues === true : stage.useIndividualValues !== false;
  const member = stage.members[owner];
  const values = counter ? member?.counterRelationValues : member?.relationValues;
  if (!enabled || !values) return null;
  const party = parties.find(p => p.id === owner);
  if (!party) throw Error('관계별 소가의 당사자를 확인하세요.');
  const opponents = relationOpponents(stage, party, parties).map(p => p.id);
  if (ids.some(id => !opponents.includes(id))) throw Error('관계별 소가의 적용 상대방을 확인하세요.');
  const issue = relationValueIssue(values, opponents, (counter ? member.counterValue : member.value) || '');
  if (issue) throw Error(issue);
  return ids.map(id => BigInt(values[id]));
}
