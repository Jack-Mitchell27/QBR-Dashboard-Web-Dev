const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, loadScript, plain } = require('./helpers.cjs');

function loadFilters() {
  const context = createContext();
  context.Store = { getAllRows: () => [] };
  loadScript(context, 'js/filters.js');
  return context.Filters;
}

const rows = [
  { Date: '2026-01-01', Category: 'Cases', Status: 'red' },
  { Date: '2026-02-01', Category: 'Cases', Status: 'amber' },
  { Date: '2026-03-01', Category: 'CSAT', Status: 'green' }
];

test('date filters are inclusive', () => {
  const Filters = loadFilters();
  Filters.set({ dateFrom: '2026-02-01', dateTo: '2026-03-01' });
  assert.deepEqual(plain(Filters.apply(rows)), [rows[1], rows[2]]);
});

test('category and status filters combine', () => {
  const Filters = loadFilters();
  Filters.set({ category: 'Cases', status: 'amber' });
  assert.deepEqual(plain(Filters.apply(rows)), [rows[1]]);
});

test('reset restores the complete dataset', () => {
  const Filters = loadFilters();
  Filters.set({ status: 'red' });
  assert.equal(Filters.apply(rows).length, 1);
  Filters.reset();
  assert.equal(Filters.apply(rows).length, 3);
});
