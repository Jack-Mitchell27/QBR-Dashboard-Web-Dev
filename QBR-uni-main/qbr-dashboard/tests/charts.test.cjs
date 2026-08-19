const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, loadScript, plain } = require('./helpers.cjs');

function loadCharts() {
  const context = createContext();
  loadScript(context, 'js/charts.js');
  return context.Charts;
}

test('metric time series keeps unlike metrics separate', () => {
  const Charts = loadCharts();
  const result = Charts.timeSeriesByMetric([
    { Date: '2026-02-01', Category: 'Cases', Metric: 'Open', Value: 10, Unit: 'count' },
    { Date: '2026-01-01', Category: 'Cases', Metric: 'Open', Value: 15, Unit: 'count' },
    { Date: '2026-01-01', Category: 'Performance', Metric: 'Resolution', Value: 3, Unit: 'hours' }
  ]);
  assert.deepEqual(plain(result.labels), ['2026-01-01', '2026-02-01']);
  assert.equal(result.datasets.length, 2);
  assert.equal(result.datasets[0].label, 'Cases - Open (count)');
  assert.deepEqual(plain(result.datasets[0].data), [15, 10]);
  assert.deepEqual(plain(result.datasets[1].data), [3, null]);
});

test('metric time series retains the final duplicate instead of summing it', () => {
  const Charts = loadCharts();
  const result = Charts.timeSeriesByMetric([
    { Date: '2026-01-01', Category: 'Cases', Metric: 'Open', Value: 10 },
    { Date: '2026-01-01', Category: 'Cases', Metric: 'Open', Value: 11 }
  ]);
  assert.deepEqual(plain(result.datasets[0].data), [11]);
});

test('latest values are selected by date and remain unaggregated', () => {
  const Charts = loadCharts();
  const result = Charts.latestByMetric([
    { Date: '2026-01-01', Category: 'Cases', Metric: 'Open', Value: 12, Status: 'red' },
    { Date: '2026-03-01', Category: 'Cases', Metric: 'Open', Value: 8, Status: 'amber' },
    { Date: '2026-02-01', Category: 'Cases', Metric: 'Open', Value: 10, Status: 'red' }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].value, 8);
  assert.equal(result[0].date, '2026-03-01');
});

test('status helpers count and roll up worst status', () => {
  const Charts = loadCharts();
  const rows = [{ Status: 'green' }, { Status: 'amber' }, { Status: 'red' }, { Status: '' }];
  assert.deepEqual(plain(Charts.statusCounts(rows)), { red: 1, amber: 1, green: 1, none: 1 });
  assert.equal(Charts.worstStatus(rows), 'red');
});
