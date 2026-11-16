import { emptyCalculation, type AllocationNode, type AllocationBranch, type CalculationInput } from './litigation-costs-calculation-types';

export function sampleCalculation(): CalculationInput {
  const c = emptyCalculation();
  const people = ['p1', 'p2', 'p3', 'p4'];
  const defendants = ['A', 'B'];
  const names = ['가', '나', '다', '라'];
  const amounts = ['102385183', '201321634', '4000000', '4000000'];
  for (const stage of ['s1', 's2']) {
    people.forEach((party, i) => c.values.push({ id: `${stage}-main-${party}`, label: `${names[i]} 본소 배분 가액`, stageId: stage, claimId: 'main', partyId: party, opponentId: '', purpose: '배분 가중치', kind: '청구', amount: amounts[i] }));
    c.values.push({ id: `${stage}-counter`, label: '반소 중복 제거 소가', stageId: stage, claimId: 'counter', partyId: 'A', opponentId: '', purpose: '보수 소가', kind: '청구', amount: '24257250' });
    c.groups.push({ id: `${stage}-main`, label: '본소 배분 가액 합계', stageId: stage, mandateId: '', claimIds: ['main'], valueIds: people.map(p => `${stage}-main-${p}`), method: '합산', note: '원고별 가액 합계. 피고 A·B 사이 중복 가액을 다시 합산하지 않음.' });
    c.groups.push({ id: `${stage}-counter-group`, label: '반소 소가', stageId: stage, mandateId: '', claimIds: ['counter'], valueIds: [`${stage}-counter`], method: '최다액', note: '가·나에 대한 연대 청구. 이 사례에서 중복 제거한 1개 가액을 기록.' });
  }
  c.values.push(
    { id: 'appeal-main', label: '피고 항소 본소 부분', stageId: 's2', claimId: 'main', partyId: '', opponentId: '', purpose: '인지 불복액', kind: '항소', amount: '158322125' },
    { id: 'appeal-counter', label: '피고 항소 반소 부분', stageId: 's2', claimId: 'counter', partyId: 'A', opponentId: '', purpose: '인지 불복액', kind: '항소', amount: '24257250' },
    { id: 'incidental', label: '원고 부대항소 본소 부분', stageId: 's2', claimId: 'main', partyId: '', opponentId: '', purpose: '보수 소가', kind: '부대항소', amount: '153384692' },
  );
  for (const stage of ['s1', 's2']) for (const mandate of ['mp', 'md']) c.groups.push({
    id: `${stage}-fee-${mandate}`, label: `${mandate === 'mp' ? '원고' : '피고'} ${stage === 's1' ? '1심' : '항소심'} 공동대리 보수 소가`,
    stageId: stage, mandateId: mandate, claimIds: ['main', 'counter'],
    valueIds: stage === 's1' ? [...people.map(p => `${stage}-main-${p}`), `${stage}-counter`] : ['appeal-main', 'appeal-counter', 'incidental'],
    method: '합산', note: '사례의 검토된 산정 기초만 기록. 인정 보수 한도를 자동 산정하지 않음.',
  });
  let seq = 0;
  const id = () => `sample-node-${++seq}`;
  const pair = (owner: string, other: string, claim: string): AllocationNode => {
    const debtor = defendants.includes(owner) ? owner : other;
    const creditor = people.includes(owner) ? owner : other;
    return { id: id(), type: 'pair', ownerId: owner, otherId: other, claimId: claim, rulingId: `${debtor}-${creditor}` };
  };
  function branch(label: string, node: AllocationNode, kind: 'value' | 'group' = 'value', refId = ''): AllocationBranch {
    return { id: id(), label, node, weight: { kind, refId, numerator: '', denominator: '' } };
  }
  const split = (label: string, method: 'equal' | 'weighted', branches: AllocationBranch[]): AllocationNode => ({ id: id(), type: 'split', label, method, branches });
  function main(stage: string, side: 'p' | 'd', weighted: boolean): AllocationNode {
    if (side === 'p') return split('본소 원고별 귀속', weighted ? 'weighted' : 'equal', people.map((p, i) => branch(names[i], split('피고별 부담 대상 배분', 'equal', defendants.map(d => branch(d, pair(p, d, 'main')))), 'value', `${stage}-main-${p}`)));
    return split('피고별 비용 귀속', 'equal', defendants.map(d => branch(d, split('상대방 원고별 배분', weighted ? 'weighted' : 'equal', people.map((p, i) => branch(names[i], pair(d, p, 'main'), 'value', `${stage}-main-${p}`))))));
  }
  const counter = (side: 'p' | 'd') => split('반소 관계 가·나와 A', 'equal', people.slice(0, 2).map((p, i) => branch(names[i], pair(side === 'p' ? p : 'A', side === 'p' ? 'A' : p, 'counter'))));
  const claimSplit = (stage: string, side: 'p' | 'd', method: 'fee' | 'stamp' | 'service') => split('본소·반소 구분', method === 'service' ? 'equal' : 'weighted', [
    branch('본소', main(stage, side, method !== 'service'), method === 'stamp' ? 'value' : 'group', method === 'stamp' ? 'appeal-main' : `${stage}-main`),
    branch('반소', counter(side), method === 'stamp' ? 'value' : 'group', method === 'stamp' ? 'appeal-counter' : `${stage}-counter-group`),
  ]);
  function plan(costId: string, root: AllocationNode, basisGroupId = '', applicationBasis = '') { c.plans.push({ costId, root, basisGroupId, applicationBasis }); }
  for (const stage of ['s1', 's2']) for (const side of ['p', 'd'] as const) {
    plan(`${side}${stage === 's1' ? '1' : '2'}fee`, claimSplit(stage, side, 'fee'), `${stage}-fee-${side === 'p' ? 'mp' : 'md'}`);
  }
  plan('p1stamp', main('s1', 'p', true));
  plan('p2stamp', main('s2', 'p', true));
  plan('p1service', main('s1', 'p', false));
  plan('p1expert', main('s1', 'p', false));
  plan('d1stamp', counter('d'));
  plan('d1service', counter('d'));
  plan('d2stamp', claimSplit('s2', 'd', 'stamp'));
  plan('d2service', claimSplit('s2', 'd', 'service'));
  plan('d2expert', main('s2', 'd', false));
  plan('application', split('신청비용 관계별 배분', 'equal', people.map((p, i) => branch(names[i], split('피고별 배분', 'equal', defendants.map(d => branch(d, pair(p, d, ''))))))), '', '첨부자료 별지 2: 확정신청 비용에 항소심 화해권고결정의 관계별 부담 비율을 적용한 사례.');
  c.rounding = { unit: '10', timing: 'direction' };
  c.setoff = 'mutual';
  return c;
}
