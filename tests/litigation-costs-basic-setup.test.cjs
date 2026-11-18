const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { registeredInstance, configureMainStages, addSetupParty, updateCaseMeta } = load('src/lib/litigation-costs-basic-setup.ts');
const { blankDraft, parseDraft } = load('src/lib/litigation-costs-draft.ts');
const { reportCaseDraft } = load('src/lib/litigation-costs-report-cases.ts');
const ids = ['s1','s2','s3','app'];
function ok(r) { assert.equal(r.ok,true,r.error); return r.draft; }

test('a fresh one-stage case needs an explicit selection, creates both procedures, and round-trips consistently', () => {
  const d=blankDraft(); assert.equal(registeredInstance(d),null);
  const configured=ok(configureMainStages(d,'제1심',ids));
  assert.deepEqual(configured.stages.map(s=>s.type),['제1심','확정신청']);
  assert.equal(d.stages.length,0); assert.equal(registeredInstance(parseDraft(JSON.stringify(configured))),'제1심');
  assert.deepEqual(ok(configureMainStages(configured,'제1심',ids)),configured);
});

for(const applicantRole of ['원고','피고']) for(const first of ['신청인','피신청인']) {
  test(`correct main-action scope: applicant ${applicantRole}, add ${first} first`,()=>{
    let d=blankDraft();
    for(const applicationRole of [first,first==='신청인'?'피신청인':'신청인']) {
      const mainRole=applicationRole==='신청인'?applicantRole:applicantRole==='원고'?'피고':'원고';
      d=ok(addSetupParty(d,{id:applicationRole,name:applicationRole,mainRole,applicationRole},'main'));
    }
    assert.deepEqual(d.claims[0].claimantIds,d.parties.filter(p=>p.mainRole==='원고').map(p=>p.id));
    assert.deepEqual(d.claims[0].opponentIds,d.parties.filter(p=>p.mainRole==='피고').map(p=>p.id));
    d=ok(configureMainStages(d,'제1심',ids)); assert.ok(d.stages.every(s=>s.partyIds.length===2));
    assert.deepEqual(parseDraft(JSON.stringify(d)),d);
  });
}

test('reducing a registered instance with referenced or entered upper-stage data is atomic and keeps selection truthful',()=>{
  for(const d of [reportCaseDraft('F03'),ok(configureMainStages(blankDraft(),'항소심',ids))]) {
    if(!d.costs.length) d.stages.find(s=>s.type==='항소심').number='입력한 항소심 사건번호';
    const before=JSON.stringify(d),r=configureMainStages(d,'제1심',ids);
    assert.equal(r.ok,false);assert.equal(JSON.stringify(d),before);assert.notEqual(registeredInstance(d),'제1심');
  }
  const d=ok(configureMainStages(blankDraft(),'상고심',ids));
  assert.equal(registeredInstance(ok(configureMainStages(d,'제1심',ids))),'제1심');
});

test('unrepresented application parties remain registered and new parties are not silently included in an existing appeal',()=>{
  const d=reportCaseDraft('F03'),r=ok(addSetupParty(d,{id:'other',name:'다른 피고',mainRole:'피고',applicationRole:'신청 대상 아님'},'unused'));
  assert.ok(r.claims[0].opponentIds.includes('other'));
  assert.ok(r.stages.filter(s=>['제1심','확정신청'].includes(s.type)).every(s=>s.partyIds.includes('other')));
  assert.ok(r.stages.filter(s=>['항소심','상고심'].includes(s.type)).every(s=>!s.partyIds.includes('other')));
  assert.deepEqual(r.calculation,d.calculation);assert.deepEqual(r.costs,d.costs);assert.deepEqual(r.review,d.review);
});

test('application number sync follows only blank/linked numbers and retains manually distinct stage numbers',()=>{
  let d=ok(configureMainStages(blankDraft(),'제1심',ids));
  d=updateCaseMeta(d,{number:'2026카확1'});assert.equal(d.stages.find(s=>s.type==='확정신청').number,'2026카확1');
  d=updateCaseMeta(d,{number:'2026카확2'});assert.equal(d.stages.find(s=>s.type==='확정신청').number,'2026카확2');
  d.stages.find(s=>s.type==='확정신청').number='직접 입력한 번호';
  assert.equal(updateCaseMeta(d,{number:'2026카확3'}).stages.find(s=>s.type==='확정신청').number,'직접 입력한 번호');
});
