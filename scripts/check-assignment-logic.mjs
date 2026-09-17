import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Exercise the real TypeScript modules with an in-memory database. No live
// accounts, assignment records, automation jobs, or emails are touched.
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const full = path.resolve(root, file);
    if (cache.has(full)) return cache.get(full).exports;
    const loadedModule = { exports: {} };
    cache.set(full, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === 'server-only') return {};
      if (id.startsWith('@/') || id.startsWith('.')) {
        const target = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(full), id);
        return load([target, target + '.ts', target + '.tsx'].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()));
      }
      return nativeRequire(id);
    };
    new Function('require', 'module', 'exports', source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

function database(tables, missingOwner = false) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    from(table) {
      const filters = []; const orders = []; let offset = 0; let count = 1000; let update; let single = false;
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value, 'eq']); return query; },
        is(key, value) { filters.push([key, value, 'eq']); return query; },
        not(key, operator, value) { assert.equal(operator, 'is'); filters.push([key, value, 'not']); return query; },
        in(key, values) { filters.push([key, values, 'in']); return query; },
        order(key, options = {}) { orders.push([key, options.ascending !== false]); return query; },
        range(start, end) { offset = start; count = end - start + 1; return query; },
        limit(value) { count = value; return query; },
        maybeSingle() { single = true; return query; },
        update(value) { update = value; return query; },
        insert() { return { then: (resolve) => Promise.resolve({ error: null }).then(resolve) }; },
        then(resolve, reject) {
          calls.push({ table, filters, offset, count, update });
          if (missingOwner && table === 'assignments' && filters.some(([key]) => key === 'owner_id')) return Promise.resolve({ data: null, error: { code: '42703', message: 'owner_id does not exist' } }).then(resolve, reject);
          let rows = (tables[table] || []).filter((row) => filters.every(([key, value, op]) => op === 'in' ? value.includes(row[key]) : op === 'not' ? (row[key] ?? null) !== value : (row[key] ?? null) === value));
          rows = [...rows].sort((a, b) => { for (const [key, ascending] of orders) { const difference = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0; if (difference) return ascending ? difference : -difference; } return 0; });
          // Simulate a response cap smaller than the requested range.
          if (!update) rows = rows.slice(offset, offset + Math.min(count, 97));
          if (update) rows.forEach((row) => Object.assign(row, update));
          return Promise.resolve({ data: single ? rows[0] || null : rows.map((row) => ({ ...row })), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, calls };
}

function dataModule(db) {
  return loader({ '@/lib/supabase/admin': { createAdminClient: () => db.client }, '@/lib/supabase/server': { createClient: async () => db.client } })('lib/assignments/data.ts');
}
const load = loader();
const utils = load('lib/assignments/utils.ts');
const logic = load('lib/assignments/browser-logic.ts');
const filters = (patch = {}) => ({ ...utils.parseAssignmentFilters({}), ...patch });
const item = (patch = {}) => ({ id: 1, owner_id: 'owner', title: 'Assignment', status: 'to_do', priority: 'medium', due_date: null, due_time: null, completed_at: null, archived_at: null, deleted_at: null, created_at: '2026-09-01T00:00:00Z', subject_name: 'General', subject_color: '#8fd6c2', search_text: 'assignment', ...patch });

test('timed deadlines become overdue on the same Philippine day; date-only tasks last through midnight', () => {
  const now = new Date('2026-09-17T04:00:00Z'); // noon in Manila
  const items = [item({ id: 1, due_date: '2026-09-17', due_time: '11:59' }), item({ id: 2, due_date: '2026-09-17', due_time: '12:01' }), item({ id: 3, due_date: '2026-09-17' }), item({ id: 4, status: 'submitted', due_date: '2026-09-16' })];
  assert.deepEqual(logic.applyFilters(items, filters({ tab: 'overdue' }), now).map((row) => row.id), [1]);
  assert.equal(logic.buildSummary(items, now).overdue, 1);
  assert.equal(utils.isAssignmentOverdue(items[2], new Date('2026-09-17T15:59:59.999Z')), false);
  assert.equal(utils.isAssignmentOverdue(items[2], new Date('2026-09-17T16:00:00Z')), true);
});

test('completion analytics use Philippine week/month boundaries and exclude reopened tasks', () => {
  const items = [item({ status: 'done', completed_at: '2026-08-31T16:15:00Z', due_date: '2026-09-01' }), item({ status: 'submitted', completed_at: '2026-08-30T16:15:00Z' }), item({ status: 'in_progress', completed_at: '2026-08-31T18:00:00Z' })];
  const result = logic.buildAnalytics(items, new Date('2026-08-31T20:00:00Z'));
  assert.equal(result.completedWeek, 2); assert.equal(result.completedMonth, 1); assert.equal(result.onTimePercent, 100);
});

test('owner and lifecycle filters apply before limits and pagination crosses the API response cap', async () => {
  const rows = Array.from({ length: 1100 }, (_, i) => item({ id: i + 1 }));
  rows.push(...Array.from({ length: 5100 }, (_, i) => item({ id: 2000 + i, owner_id: 'other', created_at: '2026-10-01T00:00:00Z' })));
  rows.push(item({ id: 9001, archived_at: '2026-09-01' }), item({ id: 9002, deleted_at: '2026-09-01' }));
  const db = database({ assignments: rows });
  const result = await dataModule(db).getAssignmentsBrowser(filters({ page: 999 }));
  assert.equal(result.totalResults, 1100); assert.equal(result.summary.all, 1100); assert.equal(result.page, 55); assert.equal(result.filters.page, 55); assert.equal(result.truncated, false);
  assert(db.calls.filter((call) => call.table === 'assignments').every((call) => call.filters.some(([key, value]) => key === 'owner_id' && value === 'owner')));
  assert(db.calls.filter((call) => call.table.startsWith('assignment_') && call.table !== 'assignment_subjects').every((call) => call.filters.find(([, , op]) => op === 'in')[1].length <= 100));
});

test('empty workspaces are not mistaken for a legacy schema; missing ownership fails closed', async () => {
  const empty = await dataModule(database({ assignments: [] })).getAssignmentsBrowser(filters());
  assert.equal(empty.legacySingleUserMode, false); assert.equal(empty.totalResults, 0);
  await assert.rejects(dataModule(database({ assignments: [item()] }, true)).getAssignmentsBrowser(filters()), /owner_id/);
});

test('calendar count follows the selected month; other owners cannot open details', async () => {
  const data = dataModule(database({ assignments: [item({ due_date: '2026-09-17' }), item({ id: 2, due_date: '2026-10-01' }), item({ id: 3, owner_id: 'other' })] }));
  const result = await data.getAssignmentsBrowser(filters({ view: 'calendar', month: '2026-09' }));
  assert.equal(result.totalResults, 1); assert.equal(result.assignments.length, 1);
  assert.equal(await data.getAssignmentDetails(3), null);
});

test('bulk completion preserves original dates and excludes archived, deleted, and foreign records', async () => {
  const rows = [item({ completed_at: '2026-09-01T00:00:00Z', status: 'submitted' }), item({ id: 2 }), item({ id: 3, owner_id: 'other' }), item({ id: 4, archived_at: '2026-09-01' }), item({ id: 5, deleted_at: '2026-09-01' })];
  const db = database({ assignments: rows });
  const server = loader({ '@/lib/supabase/admin': { createAdminClient: () => db.client }, '@/lib/supabase/server': { createClient: async () => db.client } })('lib/assignments/server.ts');
  const api = loader({ 'next/server': { NextResponse: { json: Response.json } }, '@/lib/assignments/server': server, '@/lib/assignments/automation': { ensureNextOccurrence: async () => null } })('app/api/assignments/bulk/route.ts');
  const request = (status) => new Request('http://localhost/api/assignments/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [1, 2, 3, 4, 5], action: 'status', status }) });
  const result = await (await api.POST(request('done'))).json();
  assert.equal(result.count, 2); assert.equal(rows[0].completed_at, '2026-09-01T00:00:00Z'); assert(rows[1].completed_at);
  assert(rows.slice(2).every((row) => row.status === 'to_do'));
  await api.POST(request('in_progress')); assert.equal(rows[0].completed_at, null); assert.equal(rows[1].completed_at, null);
  assert.equal(server.sanitizeDate('2024-02-29'), '2024-02-29'); assert.throws(() => server.sanitizeDate('2025-02-29'), /invalid/);
});

const uiMocks = {
  '@/components/ui/icons': new Proxy({}, { get: (_, name) => name === '__esModule' ? true : (props) => React.createElement('span', { 'aria-label': props['aria-label'] }) }),
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  'next/navigation': { useRouter: () => ({ refresh() {} }) },
  'motion/react': { motion: new Proxy({}, { get: (_, tag) => ({ children, initial, animate, transition, ...props }) => { void initial; void animate; void transition; return React.createElement(tag, props, children); } }) },
  '@/components/assignments/assignment-board': { AssignmentBoard: () => null },
  '@/components/assignments/assignment-card': { AssignmentCard: () => null },
  '@/components/assignments/assignment-editor-dialog': { AssignmentEditorDialog: () => null },
  '@/components/assignments/subject-manager-dialog': { SubjectManagerDialog: () => null },
  '@/components/ui/confirm-dialog': { confirmAction: async () => true, showNotice: async () => {} },
  '@/lib/mobile/offline-store': { mergeOfflineAssignments() {} },
};

test('empty calendar retains month navigation and days with more than three tasks expose all links', () => {
  const ui = loader(uiMocks);
  const { AssignmentBrowser } = ui('components/assignments/assignment-browser.tsx');
  const html = renderToStaticMarkup(React.createElement(AssignmentBrowser, { result: { assignments: [], subjects: [], filters: filters({ view: 'calendar', month: '2026-09' }), summary: logic.buildSummary([]), analytics: logic.buildAnalytics([]), totalResults: 0, totalPages: 1, page: 1, truncated: false, legacySingleUserMode: false, optionalTablesMissing: [] } }));
  assert.match(html, /Previous month/); assert.match(html, /Next month/); assert.match(html, /September 2026/);
  const { AssignmentCalendar } = ui('components/assignments/assignment-calendar.tsx');
  const more = renderToStaticMarkup(React.createElement(AssignmentCalendar, { assignments: [1, 2, 3, 4].map((id) => item({ id, due_date: '2026-09-17' })), filters: filters({ view: 'calendar', month: '2026-09' }) }));
  assert.match(more, /<details/); assert.match(more, /href="\/dashboard\/assignments\/4"/);
});
