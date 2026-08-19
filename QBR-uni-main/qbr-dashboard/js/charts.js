/* =============================================================
  charts.js - Chart.js renderers + shared aggregation helpers
   Exposes a global `Charts` object.
   ============================================================= */
(function () {
  'use strict';

  const PALETTE = ['#0d6efd', '#00bceb', '#1aa260', '#f4a100', '#e2231a', '#6f42c1', '#20c997', '#fd7e14', '#6610f2', '#0aa2c0'];
  const STATUS_COLORS = { red: '#e2231a', amber: '#f4a100', green: '#1aa260', none: '#94a3b8' };

  // Track live chart instances so we can destroy before re-rendering.
  const instances = {};

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }
  function destroyAll() { Object.keys(instances).forEach(destroy); }

  /* ---- Aggregation helpers ------------------------------------------- */

  // Sum of Value grouped by a field (e.g. Metric, Category, Date).
  function sumBy(rows, field) {
    const map = new Map();
    rows.forEach(r => {
      const key = r[field] || '-';
      const v = typeof r.Value === 'number' ? r.Value : 0;
      map.set(key, (map.get(key) || 0) + v);
    });
    return map;
  }

  // Time series: sum Value per Date (sorted ascending).
  function timeSeries(rows, field) {
    const map = sumBy(rows, field || 'Date');
    const arr = Array.from(map.entries());
    arr.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return { labels: arr.map(x => x[0]), values: arr.map(x => x[1]) };
  }

  // Build one line per sub-category/metric so unlike units are never summed.
  function timeSeriesByMetric(rows, field) {
    const dateField = field || 'Date';
    const labels = Array.from(new Set(rows.map(r => r[dateField]).filter(Boolean))).sort();
    const groups = new Map();
    rows.forEach((r, index) => {
      if (!r[dateField] || typeof r.Value !== 'number') return;
      const baseLabel = [r.Category, r.Metric].filter(Boolean).join(' - ') || 'Metric';
      const key = baseLabel + '\u0000' + (r.Unit || '');
      if (!groups.has(key)) groups.set(key, { label: baseLabel, unit: r.Unit || '', points: new Map(), order: index });
      // If a source contains duplicate dates for the same metric, retain the
      // final source row rather than inventing a total across duplicate data.
      groups.get(key).points.set(r[dateField], r.Value);
    });
    const datasets = Array.from(groups.values())
      .sort((a, b) => a.order - b.order)
      .map(group => ({
        label: group.label + (group.unit ? ' (' + group.unit + ')' : ''),
        data: labels.map(label => group.points.has(label) ? group.points.get(label) : null),
        spanGaps: true
      }));
    return { labels, datasets };
  }

  // Latest recorded value per sub-category/metric (not a sum across periods).
  function latestByMetric(rows) {
    const latest = new Map();
    rows.forEach((r, index) => {
      if (typeof r.Value !== 'number') return;
      const label = [r.Category, r.Metric].filter(Boolean).join(' - ') || 'Metric';
      const current = latest.get(label);
      if (!current || String(r.Date || '').localeCompare(String(current.date || '')) > 0 ||
          (r.Date === current.date && index > current.index)) {
        latest.set(label, {
          label,
          value: r.Value,
          unit: r.Unit || '',
          status: r.Status || 'none',
          date: r.Date || '',
          index
        });
      }
    });
    return Array.from(latest.values());
  }

  // Count rows per status (red/amber/green/none).
  function statusCounts(rows) {
    const counts = { red: 0, amber: 0, green: 0, none: 0 };
    rows.forEach(r => { counts[r.Status || 'none'] = (counts[r.Status || 'none'] || 0) + 1; });
    return counts;
  }

  // Worst status present in a set of rows (for roll-up colouring).
  function worstStatus(rows) {
    const c = statusCounts(rows);
    if (c.red > 0) return 'red';
    if (c.amber > 0) return 'amber';
    if (c.green > 0) return 'green';
    return 'none';
  }

  /* ---- Common Chart.js options --------------------------------------- */
  const baseOptions = (extra) => Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true, font: { family: 'Inter' } } },
      tooltip: {
        backgroundColor: '#0f1b2d',
        padding: 10, cornerRadius: 8,
        titleFont: { family: 'Inter', weight: '600' },
        bodyFont: { family: 'Inter' },
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
            const val = ctx.parsed && typeof ctx.parsed === 'object'
              ? (ctx.chart.options.indexAxis === 'y' ? ctx.parsed.x : ctx.parsed.y)
              : ctx.parsed;
            return label + formatNumber(val);
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } },
      y: { beginAtZero: true, grid: { color: '#eef2f7' }, ticks: { font: { family: 'Inter' } } }
    }
  }, extra || {});

  function formatNumber(n) {
    if (n == null || isNaN(n)) return '-';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return (Math.round(n * 100) / 100).toLocaleString();
  }

  /* ---- Renderers ----------------------------------------------------- */

  function line(canvas, id, labels, datasets) {
    destroy(id);
    const ctx = canvas.getContext('2d');
    instances[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((d, i) => Object.assign({
          borderColor: PALETTE[i % PALETTE.length],
          backgroundColor: hexToRgba(PALETTE[i % PALETTE.length], 0.12),
          borderWidth: 2, tension: 0.35, fill: true,
          pointRadius: 2, pointHoverRadius: 5
        }, d))
      },
      options: baseOptions()
    });
    return instances[id];
  }

  function bar(canvas, id, labels, datasets, opts) {
    destroy(id);
    const ctx = canvas.getContext('2d');
    instances[id] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map((d, i) => Object.assign({
          backgroundColor: d.backgroundColor || PALETTE[i % PALETTE.length],
          borderRadius: 6, maxBarThickness: 46
        }, d))
      },
      options: baseOptions(opts)
    });
    return instances[id];
  }

  function doughnut(canvas, id, labels, values, colors) {
    destroy(id);
    const ctx = canvas.getContext('2d');
    instances[id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors || labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 2, borderColor: '#fff'
        }]
      },
      options: baseOptions({
        cutout: '62%',
        scales: {},
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { family: 'Inter' } } },
          tooltip: {
            backgroundColor: '#0f1b2d', padding: 10, cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ctx.label + ': ' + formatNumber(ctx.parsed) + ' (' + pct + '%)';
              }
            }
          }
        }
      })
    });
    return instances[id];
  }

  // Status doughnut with fixed red/amber/green ordering and colours.
  function statusDoughnut(canvas, id, rows) {
    const c = statusCounts(rows);
    const labels = [], values = [], colors = [];
    [['green', 'Green'], ['amber', 'Amber'], ['red', 'Red'], ['none', 'No status']].forEach(([k, label]) => {
      if (c[k] > 0) { labels.push(label); values.push(c[k]); colors.push(STATUS_COLORS[k]); }
    });
    if (values.length === 0) { labels.push('No data'); values.push(1); colors.push('#e2e8f0'); }
    return doughnut(canvas, id, labels, values, colors);
  }

  function hexToRgba(hex, a) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  window.Charts = {
    PALETTE, STATUS_COLORS,
    sumBy, timeSeries, timeSeriesByMetric, latestByMetric, statusCounts, worstStatus,
    line, bar, doughnut, statusDoughnut,
    formatNumber, destroy, destroyAll
  };
})();
