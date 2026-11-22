const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');

const data = {
  court: '서울중앙지방법원',
  caseNumber: '2026카확12345',
  applicationDate: '2026-11-22',
  parties: [{ id: 'a', name: '신청인', group: '신청인' }],
  stages: [{ id: 'first', costs: [], rules: [] }],
  applicationCosts: [],
};
const request = (url, method = 'GET', body) => new NextRequest(`http://localhost${url}`, {
  method,
  ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
});

test('litigation-cost records require authentication and are scoped to their owner', async () => {
  let userId = null;
  const calls = [];
  const load = require('./load-ts.cjs')({
    '@/lib/auth': { getUserIdFromRequest: async () => userId },
    '@/lib/db': { query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    } },
  });
  const listRoute = load('src/app/api/litigation-costs/route.ts');
  const itemRoute = load('src/app/api/litigation-costs/[id]/route.ts');

  assert.equal((await listRoute.GET(request('/api/litigation-costs'))).status, 401);
  assert.equal((await itemRoute.DELETE(request('/api/litigation-costs/14', 'DELETE'), { params: Promise.resolve({ id: '14' }) })).status, 401);
  userId = 7;
  assert.equal((await itemRoute.GET(request('/api/litigation-costs/14'), { params: Promise.resolve({ id: '14' }) })).status, 404);
  assert.deepEqual(calls.at(-1).params, ['14', 7]);
  assert.equal((await itemRoute.GET(request('/api/litigation-costs/14'), { params: Promise.resolve({ id: '0' }) })).status, 404);
  assert.equal((await itemRoute.DELETE(request('/api/litigation-costs/0', 'DELETE'), { params: Promise.resolve({ id: '0' }) })).status, 404);
});

test('litigation-cost records save, update, and delete the complete input as JSON', async () => {
  const calls = [];
  let nextRowCount = 1;
  const load = require('./load-ts.cjs')({
    '@/lib/auth': { getUserIdFromRequest: async () => 7 },
    '@/lib/db': { query: async (sql, params) => {
      calls.push({ sql, params });
      return sql.includes('RETURNING id') ? { rows: [{ id: 14 }] } : { rows: [], rowCount: nextRowCount };
    } },
  });
  const listRoute = load('src/app/api/litigation-costs/route.ts');
  const itemRoute = load('src/app/api/litigation-costs/[id]/route.ts');

  const created = await listRoute.POST(request('/api/litigation-costs', 'POST', data));
  assert.equal(created.status, 200);
  assert.equal((await created.json()).id, 14);
  assert.equal(calls[0].params[0], 7);
  assert.deepEqual(JSON.parse(calls[0].params[5]), data);

  const updated = await itemRoute.PATCH(request('/api/litigation-costs/14', 'PATCH', data), {
    params: Promise.resolve({ id: '14' }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(JSON.parse(calls[1].params[4]), data);
  assert.deepEqual(calls[1].params.slice(-2), ['14', 7]);

  const deleted = await itemRoute.DELETE(request('/api/litigation-costs/14', 'DELETE'), {
    params: Promise.resolve({ id: '14' }),
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(calls[2].params, ['14', 7]);

  nextRowCount = 0;
  const missingDelete = await itemRoute.DELETE(request('/api/litigation-costs/14', 'DELETE'), {
    params: Promise.resolve({ id: '14' }),
  });
  assert.equal(missingDelete.status, 404);

  const invalid = await listRoute.POST(request('/api/litigation-costs', 'POST', { ...data, stages: {} }));
  assert.equal(invalid.status, 400);
  assert.equal(calls.length, 4);
});