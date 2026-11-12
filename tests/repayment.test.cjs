const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { calculateRepayment } = load('src/lib/repayment-calculator.ts');
const c = (id, principal, isPreferential = false) => ({ id, number: id, name: id, principal, isPreferential });
const p = (monthly, months, seized = 0) => ({ monthlyActualAvailableIncome: monthly,
  repaymentPeriod: { months }, seizedReservesStatus: seized ? 'yes' : 'no', seizedReservesAmount: seized });
test('payments never exceed debt, including final rounds', () => {
  const result = calculateRepayment([c('a', 100)], p(200, 3));
  assert.deepEqual(result.schedule.map(r => r.total), [100, 0, 0]);
  assert.equal(result.creditorTotals[0].repaymentRate, 100);
});
test('priority completion distributes remaining money only once', () => {
  const result = calculateRepayment([c('p', 100, true), c('r', 1000)], p(200, 6));
  assert.equal(result.schedule[0].payments.r, 100);
  assert.equal(result.schedule[5].payments.r, 100);
  assert.equal(result.creditorTotals.find(c => c.creditorId === 'r').totalPayment, 1000);
});
test('seized rounding preserves exact resources and actual row totals', () => {
  const result = calculateRepayment([c('a', 10000)], p(100, 4, 101));
  assert.equal(result.schedule.reduce((s, r) => s + r.total, 0), 400);
  for (const row of result.schedule) assert.equal(row.total, Object.values(row.payments).reduce((a,b) => a+b,0));
  const capped = calculateRepayment([c('a',100)],p(200,2,50));
  assert.deepEqual(capped.schedule.map(r => r.total),[50,50]);
});
test('secured and subrogated claims share the same capped calculation', () => {
  const result = calculateRepayment([{...c('a', 1000), isSecured:true, securedData:{unrepayableAmount:100},
    subrogatedList:[c('sub', 200)]}], p(500,1));
  assert.equal(result.creditorTotals.length,2);
  assert.equal(result.schedule[0].total,300);
});
test('invalid amounts, duplicated IDs and invalid reserves are rejected', () => {
  for (const plan of [p(-1,36),p(100,0),p(100,121),p(100,2,201),p(100,1,50)]) {
    assert.throws(() => calculateRepayment([c('a',1000)],plan));
  }
  assert.throws(() => calculateRepayment([c('a',100),c('a',100)],p(100,2)));
});
test('randomized schedules conserve money, respect priority and never overpay', () => {
  let seed=42;const rand=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
  for(let i=0;i<300;i++){
    const creditors=Array.from({length:1+rand(8)},(_,j)=>c(String(j),rand(10000),rand(3)===0));
    const monthly=rand(5000),months=1+rand(60);
    const result=calculateRepayment(creditors,p(monthly,months));
    const paid=new Map(creditors.map(c=>[c.id,0]));
    for(const row of result.schedule){
      assert.ok(row.total<=monthly);
      assert.equal(row.total,Object.values(row.payments).reduce((a,b)=>a+b,0));
      for(const [id,value] of Object.entries(row.payments)){assert.ok(value>=0);paid.set(id,paid.get(id)+value);}
      if(creditors.some(c=>c.isPreferential&&paid.get(c.id)<c.principal)){
        for(const c of creditors.filter(c=>!c.isPreferential))assert.equal(row.payments[c.id]||0,0);
      }
    }
    for(const c of creditors)assert.ok(paid.get(c.id)<=c.principal);
    assert.equal([...paid.values()].reduce((a,b)=>a+b,0),Math.min(monthly*months,creditors.reduce((s,c)=>s+c.principal,0)));
  }
});
