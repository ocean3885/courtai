const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { consumeAttempt } = load('src/lib/rate-limit.ts');
const { compareSnapshots } = load('src/lib/snapshot-diff.ts');
test('login limits expire and do not affect unrelated accounts', () => {
  assert.equal(consumeAttempt('a',2,10000,0),0);
  assert.equal(consumeAttempt('a',2,10000,100),0);
  assert.ok(consumeAttempt('a',2,10000,200)>0);
  assert.equal(consumeAttempt('b',2,10000,200),0);
  assert.equal(consumeAttempt('a',2,10000,10000),0);
});
test('history includes secured and nested subrogated changes, including zero values', () => {
  const old={creditors:[{id:'a',number:'1',securedData:{unrepayableAmount:100},subrogatedList:[{id:'s',number:'1-1',principal:10}]}]};
  const next=JSON.parse(JSON.stringify(old));
  next.creditors[0].securedData.unrepayableAmount=0;
  next.creditors[0].subrogatedList[0].principal=20;
  const changes=compareSnapshots(old,next);
  assert.ok(changes.some(c=>c.field.endsWith('unrepayableAmount')&&c.newValue===0));
  assert.ok(changes.some(c=>c.field.endsWith('principal')&&c.newValue===20));
});
