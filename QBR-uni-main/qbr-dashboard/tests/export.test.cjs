const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, loadScript } = require('./helpers.cjs');

function loadExporter() {
  const context = createContext();
  loadScript(context, 'vendor/papaparse.min.js');
  loadScript(context, 'js/export.js');
  return context;
}

test('CSV export includes Unit and Direction and neutralises spreadsheet formulas', () => {
  const context = loadExporter();
  const csv = context.Exporter.buildConsolidatedCsv([{
    _categoryName: 'TAC',
    Date: '2026-08-18',
    Category: 'Cases',
    Metric: '=DANGEROUS()',
    Value: 3,
    Unit: 'count',
    Target: 0,
    Direction: 'lower',
    Status: 'red',
    Version: '',
    CaseID: '',
    Owner: '@owner',
    Notes: '+formula'
  }]);
  const parsed = context.Papa.parse(csv, { header: true });
  assert.equal(parsed.data[0].Unit, 'count');
  assert.equal(parsed.data[0].Direction, 'lower');
  assert.equal(parsed.data[0].Metric, "'=DANGEROUS()");
  assert.equal(parsed.data[0].Owner, "'@owner");
  assert.equal(parsed.data[0].Notes, "'+formula");
});

test('PDF body includes every supplied row', () => {
  const context = loadExporter();
  const rows = Array.from({ length: 45 }, (_, i) => ({
    Date: '2026-08-18', Category: 'Cases', Metric: 'Open', Value: i,
    Unit: 'count', Target: 10, Status: 'green', Owner: 'Team', CaseID: 'CASE-' + i
  }));
  const body = context.Exporter.buildPdfBody(rows);
  assert.equal(body.length, 45);
  assert.equal(body[44][8], 'CASE-44');
});
