const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-secret-used-only-by-local-regression-tests';
let user = { id:1, username:'test', name:'Test', role:'ADMIN', is_active:1, password:'hash-one' };
const load = require('./load-ts.cjs')({ '@/lib/db':{query: async () => ({rows:user ? [{...user}] : []})},
  './db':{query: async () => ({rows:user ? [{...user}] : []})} });
const auth = load('src/lib/auth.ts');
const request = token => ({cookies:{get:()=>token ? {value:token} : undefined}});
test('sessions use current roles and revoke on password change, disable and deletion', async () => {
  const token=auth.createAuthToken(user);
  assert.equal((await auth.getUserFromRequest(request(token))).role,'ADMIN');
  user.role='USER';
  assert.equal(await auth.isAdminRequest(request(token)),false);
  user.is_active=0;assert.equal(await auth.getUserFromRequest(request(token)),null);
  user.is_active=1;user.password='hash-two';assert.equal(await auth.getUserFromRequest(request(token)),null);
  const fresh=auth.createAuthToken(user);assert.ok(await auth.getUserFromRequest(request(fresh)));
  user=null;assert.equal(await auth.getUserFromRequest(request(fresh)),null);
});
test('legacy, malformed, expired and wrong-algorithm tokens are rejected', async () => {
  for(const token of [undefined,'invalid',jwt.sign({id:1,role:'ADMIN'},process.env.JWT_SECRET),
    jwt.sign({id:1,passwordVersion:'x'},process.env.JWT_SECRET,{expiresIn:-1}),
    jwt.sign({id:1,passwordVersion:'x'},process.env.JWT_SECRET,{algorithm:'HS384'})]) {
    assert.equal(await auth.getUserFromRequest(request(token)),null);
  }
});
