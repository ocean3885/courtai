const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL='postgresql://test:test@localhost/test';
process.env.ADMIN_USERNAME='initial';process.env.ADMIN_PASSWORD='initial-password';
test('bootstrap preserves passwords, failed initialization retries, and transactions roll back', async () => {
  const calls=[];let failInit=true,released=0;
  const client={query:async(sql)=>{calls.push(sql);return {rows:[],rowCount:1};},release:()=>released++};
  const load=require('./load-ts.cjs')({pg:{Pool:class{
    async query(sql){calls.push(sql);if(failInit){failInit=false;throw new Error('temporary database outage');}return {rows:[]};}
    async connect(){return client;}
  }},bcryptjs:{hash:async()=> 'test-hash'}});
  const db=load('src/lib/db.ts');
  await assert.rejects(db.ensureDbInitialized(),/temporary/);
  await db.ensureDbInitialized();
  assert.ok(calls.some(sql=>sql.includes('ON CONFLICT(username) DO NOTHING')));
  assert.ok(!calls.some(sql=>sql.includes('DO UPDATE')));
  await assert.rejects(db.transaction(async run=>{await run('UPDATE example');throw new Error('abort');}),/abort/);
  assert.equal(calls.at(-1),'ROLLBACK');assert.equal(released,1);
  await db.transaction(async run=>{await run('SELECT 1');});
  assert.equal(calls.at(-1),'COMMIT');assert.equal(released,2);
});
