/* =============================================================
   app.js — bootstrap, routing, views, and wiring
   Depends on: Store, Parser          <div class="cat-card__top">
          <div>
            <div class="card__title">${escapeHtml(cat.name)}</div>arts, Tables, Filters, Upload, Exporter
   ============================================================= */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---- Toast notifications (exposed for other modules) --------------- */
  const Toast = (function () {
    const host = $('#toastHost');
    function show(msg, kind, timeout) {
      const el = document.createElement('div');
      el.className = 'toast' + (kind ? ' toast--' + kind : '');
      el.innerHTML = `<span>${escapeHtml(msg)}</span><button class="toast__close" aria-label="Dismiss">×</button>`;
      el.querySelector('.toast__close').addEventListener('click', () => remove(el));
      host.appendChild(el);
      setTimeout(() => remove(el), timeout || 3800);
    }
    function remove(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
    return { show };
  })();
  window.Toast = Toast;

  /* ---- Routing ------------------------------------------------------- */
  let currentView = 'overview';

  const VIEW_TITLES = {
    overview: ['Overview', 'Each category shown independently with its own metrics and status'],
    upload:   ['Upload Data', 'Import CSV files for each category — parsed locally in your browser'],
    settings: ['Settings', 'Schema reference, data management, and export options']
  };

  function navigate(view) {
    currentView = view;
    window.Charts.destroyAll();

    // Sidebar active state
    $$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));

    // Title
    const cat = window.Store.getCategory(view);
    if (cat) {
      $('#viewTitle').textContent = cat.name;
      $('#viewSubtitle').textContent = cat.desc;
    } else {
      const [t, s] = VIEW_TITLES[view] || ['Overview', ''];
      $('#viewTitle').textContent = t;
      $('#viewSubtitle').textContent = s;
    }

    // Filters bar only relevant for data views
    const showFilters = view === 'overview' || !!cat;
    $('#filters').classList.toggle('hidden', !showFilters);

    render();

    // Close mobile nav, move focus
    $('#app').classList.remove('nav-open');
    $('#content').focus({ preventScroll: true });
  }

  /* ---- Master render dispatcher -------------------------------------- */
  function render() {
    const content = $('#content');
    const cat = window.Store.getCategory(currentView);

    if (currentView === 'overview') return renderOverview(content);
    if (currentView === 'upload') return window.Upload.renderUploadView(content, onDataChanged);
    if (currentView === 'settings') return renderSettings(content);
    if (cat) return renderCategory(content, cat);
    return renderOverview(content);
  }

  /* ---- Overview view ------------------------------------------------- */
  function renderOverview(content) {
    const cats = window.Store.getCategories();
    if (window.Store.isEmpty()) return renderEmptyState(content);

    // Each category is independent — render its own panel with its own chart/summary
    let panels = '';
    const catsWithData = [];
    const catsEmpty = [];

    cats.forEach(c => {
      const rows = window.Filters.apply(window.Store.getRows(c.id).map(r => Object.assign({ _categoryId: c.id }, r)));
      if (rows.length) catsWithData.push({ cat: c, rows });
      else catsEmpty.push(c);
    });

    catsWithData.forEach(({ cat, rows }, idx) => {
      const sc = window.Charts.statusCounts(rows);
      const metricsCount = new Set(rows.map(r => r.Metric)).size;
      const cases = new Set(rows.filter(r => r.CaseID).map(r => r.CaseID)).size;
      const worst = window.Charts.worstStatus(rows);

      panels += `
        <div class="overview-panel" data-cat="${cat.id}">
          <div class="overview-panel__header">
            <div>
              <h2 class="overview-panel__title">${escapeHtml(cat.name)}</h2>
              <span class="muted">${escapeHtml(cat.desc)}</span>
            </div>
            <button class="btn btn--ghost btn--sm" data-nav="${cat.id}">View details</button>
          </div>
          <div class="kpi-grid kpi-grid--compact">
            ${kpiTile('Data points', rows.length, metricsCount + ' distinct metrics', 'green')}
            ${kpiTile('Red', sc.red, sc.red ? 'attention needed' : 'none', sc.red ? 'red' : 'green')}
            ${kpiTile('Amber', sc.amber, sc.amber ? 'monitor' : 'none', sc.amber ? 'amber' : 'green')}
            ${kpiTile('Green', sc.green, 'on track', 'green')}
            ${cases ? kpiTile('Cases', cases, 'open references', 'amber') : ''}
          </div>
          <div class="card-grid" style="margin-bottom:0">
            <div class="card card--span-8">
              <div class="card__head"><span class="card__title">Trend</span><span class="muted">Value over time</span></div>
              <div class="card__body card__body--chart"><canvas id="ovTrend_${cat.id}"></canvas></div>
            </div>
            <div class="card card--span-4">
              <div class="card__head"><span class="card__title">Status</span></div>
              <div class="card__body card__body--chart"><canvas id="ovStatus_${cat.id}"></canvas></div>
            </div>
          </div>
        </div>
      `;
    });

    // Show empty categories in a compact section at the bottom
    let emptySection = '';
    if (catsEmpty.length) {
      emptySection = `
        <div class="section-head" style="margin-top:32px"><h2>No data yet</h2><span class="muted">upload CSVs to populate these categories</span></div>
        <div class="card-grid">${catsEmpty.map(c => `
          <div class="card cat-card cat-card--empty card--span-4" data-nav="${c.id}">
            <div class="card__body">
              <div class="card__title">${escapeHtml(c.name)}</div>
              <div class="muted" style="font-size:12px">${escapeHtml(c.desc)}</div>
            </div>
          </div>`).join('')}
        </div>
      `;
    }

    content.innerHTML = panels + emptySection;

    // Render independent charts per category
    catsWithData.forEach(({ cat, rows }) => {
      const ts = window.Charts.timeSeries(rows, 'Date');
      const trendCanvas = $(`#ovTrend_${cat.id}`);
      const statusCanvas = $(`#ovStatus_${cat.id}`);
      if (ts.labels.length && trendCanvas) {
        window.Charts.line(trendCanvas, 'ovTrend_' + cat.id, ts.labels, [{ label: cat.name, data: ts.values }]);
      }
      if (statusCanvas) {
        window.Charts.statusDoughnut(statusCanvas, 'ovStatus_' + cat.id, rows);
      }
    });

    // Wire navigation buttons
    $$('[data-nav]', content).forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(el.dataset.nav);
      });
    });
  }

  /* ---- Per-category view --------------------------------------------- */
  function renderCategory(content, cat) {
    const rawRows = window.Store.getRows(cat.id).map(r => Object.assign({ _categoryId: cat.id, _categoryName: cat.name }, r));
    const rows = window.Filters.apply(rawRows);

    if (rawRows.length === 0) {
      content.innerHTML = `
        <div class="empty">
          <h3>No data for ${escapeHtml(cat.name)} yet</h3>
          <p>Import a CSV for this category to see metrics, trends and a detailed table.</p>
          <div class="flex gap-8" style="justify-content:center">
            <button class="btn btn--primary" id="goUpload">Upload ${escapeHtml(cat.name)} CSV</button>
            <button class="btn btn--ghost" id="dlTemplate">Download template</button>
          </div>
        </div>`;
      $('#goUpload').addEventListener('click', () => navigate('upload'));
      $('#dlTemplate').addEventListener('click', () => window.Store.downloadTemplate(cat.id));
      return;
    }

    const sc = window.Charts.statusCounts(rows);
    const sum = rows.reduce((a, r) => a + (typeof r.Value === 'number' ? r.Value : 0), 0);
    const metricsCount = new Set(rows.map(r => r.Metric)).size;
    const cases = new Set(rows.filter(r => r.CaseID).map(r => r.CaseID)).size;

    content.innerHTML = `
      <div class="kpi-grid">
        ${kpiTile('Total Value', window.Charts.formatNumber(sum), rows.length + ' data points', window.Charts.worstStatus(rows))}
        ${kpiTile('Distinct metrics', metricsCount, 'tracked in this category', 'green')}
        ${kpiTile('Open cases / refs', cases, 'with a Case ID', cases ? 'amber' : 'green')}
        ${kpiTile('Status', `${sc.red}/${sc.amber}/${sc.green}`, 'red / amber / green', window.Charts.worstStatus(rows))}
      </div>

      <div class="card-grid" style="margin-bottom:18px">
        <div class="card card--span-8">
          <div class="card__head"><span class="card__title">${escapeHtml(cat.name)} — trend</span><span class="muted">Value by Date</span></div>
          <div class="card__body card__body--chart"><canvas id="catTrend"></canvas></div>
        </div>
        <div class="card card--span-4">
          <div class="card__head"><span class="card__title">Status mix</span></div>
          <div class="card__body card__body--chart"><canvas id="catStatus"></canvas></div>
        </div>
        <div class="card card--span-12">
          <div class="card__head"><span class="card__title">By metric</span></div>
          <div class="card__body card__body--chart"><canvas id="catByMetric"></canvas></div>
        </div>
      </div>

      <div class="card card--span-12">
        <div class="card__head">
          <span class="card__title">Detailed data</span>
          <span class="muted">conditional traffic-light formatting</span>
          <div class="card__head-actions">
            <button class="btn btn--ghost btn--sm" id="catClear">Clear category</button>
          </div>
        </div>
        <div class="card__body"><div id="catTable"></div></div>
      </div>
    `;

    // Charts
    const ts = window.Charts.timeSeries(rows, 'Date');
    if (ts.labels.length) window.Charts.line($('#catTrend'), 'catTrend', ts.labels, [{ label: 'Value', data: ts.values }]);
    window.Charts.statusDoughnut($('#catStatus'), 'catStatus', rows);

    const byMetric = window.Charts.sumBy(rows, 'Metric');
    const mLabels = Array.from(byMetric.keys());
    const mValues = Array.from(byMetric.values());
    window.Charts.bar($('#catByMetric'), 'catByMetric', mLabels, [{ label: 'Value', data: mValues }], { indexAxis: mLabels.length > 8 ? 'y' : 'x' });

    // Table
    window.Tables.render($('#catTable'), rows, { showCategory: false });

    $('#catClear').addEventListener('click', () => {
      if (!confirm('Clear all data for ' + cat.name + '?')) return;
      window.Store.clearCategory(cat.id);
      Toast.show(cat.name + ' cleared', 'warn');
      onDataChanged();
    });
  }

  /* ---- Settings view ------------------------------------------------- */
  function renderSettings(content) {
    const schema = window.Store.SCHEMA;
    const updated = window.Store.getUpdatedAt();
    const sizeKB = window.Store.storageSizeKB();

    content.innerHTML = `
      <div class="section-head"><h2>Data management</h2></div>

      <div class="setting-row">
        <div class="setting-row__text">
          <strong>Consolidated export</strong>
          <span>Download every category's rows as one CSV, or a formatted PDF report.</span>
        </div>
        <button class="btn btn--ghost" id="setCsv">Export CSV</button>
        <button class="btn btn--primary" id="setPdf">Export PDF</button>
      </div>

      <div class="setting-row">
        <div class="setting-row__text">
          <strong>Storage</strong>
          <span>${window.Store.totalRows().toLocaleString()} rows in localStorage · ~${sizeKB} KB · last updated ${updated ? new Date(updated).toLocaleString() : '—'}</span>
        </div>
        <button class="btn btn--danger" id="setClear">Clear all data</button>
      </div>

      <div class="section-head" style="margin-top:26px"><h2>CSV schema reference</h2><span class="muted">required columns must be present or the file is rejected</span></div>
      <div class="card card--span-12">
        <div class="card__body">
          <table class="schema-table">
            <thead><tr><th>Column</th><th>Required</th><th>Type / format</th><th>Description</th></tr></thead>
            <tbody>
              ${schema.docs.map(d => `
                <tr>
                  <td><code>${d.col}</code></td>
                  <td>${d.required ? '<span class="req-yes">Required</span>' : '<span class="req-no">Optional</span>'}</td>
                  <td><code>${escapeHtml(d.type)}</code></td>
                  <td>${escapeHtml(d.desc)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <p class="muted" style="margin:14px 2px 0">
            Tip: <code>Status</code> accepts <code>red</code>/<code>amber</code>/<code>green</code> (or RAG synonyms). If omitted,
            status is auto-derived from <code>Value</code> vs <code>Target</code>. <code>CaseID</code> is ideal for tracking fixes like <code>CSCvi23216</code>.
          </p>
        </div>
      </div>

      <div class="section-head" style="margin-top:26px"><h2>Templates</h2><span class="muted">one per category</span></div>
      <div class="upload-grid" id="tplGrid"></div>
    `;

    $('#setCsv').addEventListener('click', () => window.Exporter.downloadConsolidatedCsv());
    $('#setPdf').addEventListener('click', exportPdf);
    $('#setClear').addEventListener('click', clearAllData);

    const tplGrid = $('#tplGrid');
    window.Store.getCategories().forEach(c => {
      const el = document.createElement('div');
      el.className = 'setting-row';
      el.style.margin = '0';
      el.innerHTML = `
        <div class="setting-row__text"><strong>${escapeHtml(c.name)}</strong><span><code>template_${c.id}.csv</code></span></div>
        <button class="btn btn--ghost btn--sm tpl-dl">Download</button>`;
      el.querySelector('.tpl-dl').addEventListener('click', () => window.Store.downloadTemplate(c.id));
      tplGrid.appendChild(el);
    });
  }

  /* ---- Empty state --------------------------------------------------- */
  function renderEmptyState(content) {
    content.innerHTML = `
      <div class="empty">
        <h3>No data yet</h3>
        <p>Upload CSV files for any of the 8 categories to populate your QBR dashboard.
           All parsing happens locally — your data never leaves this browser.</p>
        <div class="flex gap-8" style="justify-content:center">
          <button class="btn btn--primary" id="emptyUpload">Go to Upload</button>
          <button class="btn btn--ghost" id="emptySettings">View CSV schema</button>
        </div>
      </div>`;
    $('#emptyUpload').addEventListener('click', () => navigate('upload'));
    $('#emptySettings').addEventListener('click', () => navigate('settings'));
  }

  /* ---- Shared UI builders -------------------------------------------- */
  function kpiTile(label, value, meta, status) {
    const cls = status ? ' is-' + status : '';
    return `<div class="kpi${cls}">
      <div class="kpi__label">${label}</div>
      <div class="kpi__value">${value}</div>
      <div class="kpi__meta">${escapeHtml(meta || '')}</div>
    </div>`;
  }

  function statusPill(status) {
    const map = { red: ['status--red', 'Red'], amber: ['status--amber', 'Amber'], green: ['status--green', 'Green'] };
    const [cls, label] = map[status] || ['status--none', 'No status'];
    return `<span class="status-pill ${cls}"><span class="status-dot"></span>${label}</span>`;
  }

  /* ---- Sidebar category nav ------------------------------------------ */
  function buildCategoryNav() {
    const host = $('#navCategories');
    host.innerHTML = '';
    window.Store.getCategories().forEach(c => {
      const count = window.Store.getRows(c.id).length;
      const btn = document.createElement('button');
      btn.className = 'nav__item';
      btn.dataset.view = c.id;
      btn.innerHTML = `<span>${escapeHtml(c.name)}</span>
        <span class="nav__badge ${count ? '' : 'is-empty'}">${count || 0}</span>`;
      btn.addEventListener('click', () => navigate(c.id));
      host.appendChild(btn);
    });
  }

  /* ---- Data change handler ------------------------------------------- */
  function onDataChanged() {
    buildCategoryNav();
    $$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === currentView));
    window.Filters.populateCategoryOptions($('#filterCategory'));
    updateStorageInfo();
    render();
  }

  function updateStorageInfo() {
    const info = $('#storageInfo');
    const updated = window.Store.getUpdatedAt();
    info.textContent = `${window.Store.totalRows().toLocaleString()} rows · ~${window.Store.storageSizeKB()} KB` +
      (updated ? ` · saved ${new Date(updated).toLocaleTimeString()}` : '');
  }

  /* ---- Top-bar / global actions -------------------------------------- */
  function exportPdf() {
    const f = window.Filters.get();
    const rows = window.Filters.apply(window.Store.getAllRows());
    const parts = [];
    if (f.dateFrom) parts.push('from ' + f.dateFrom);
    if (f.dateTo) parts.push('to ' + f.dateTo);
    if (f.category) parts.push('category=' + f.category);
    if (f.status) parts.push('status=' + f.status);
    window.Exporter.downloadPdfReport({ rows, filterSummary: parts.join(', ') || 'none' });
  }

  function clearAllData() {
    if (!confirm('This will permanently remove ALL imported data from this browser. Continue?')) return;
    window.Store.clearAll();
    Toast.show('All data cleared', 'warn');
    onDataChanged();
  }

  /* ---- Wiring -------------------------------------------------------- */
  function wireGlobalControls() {
    // Static nav buttons (overview/upload/settings)
    $$('.nav__item[data-view]').forEach(btn => {
      if (['overview', 'upload', 'settings'].includes(btn.dataset.view)) {
        btn.addEventListener('click', () => navigate(btn.dataset.view));
      }
    });

    $('#menuToggle').addEventListener('click', () => $('#app').classList.toggle('nav-open'));
    $('#downloadCsvBtn').addEventListener('click', () => window.Exporter.downloadConsolidatedCsv(window.Filters.apply(window.Store.getAllRows())));
    $('#downloadPdfBtn').addEventListener('click', exportPdf);

    // Filters
    const fromEl = $('#filterDateFrom'), toEl = $('#filterDateTo'), catEl = $('#filterCategory'), statusEl = $('#filterStatus');
    fromEl.addEventListener('change', () => window.Filters.set({ dateFrom: fromEl.value }));
    toEl.addEventListener('change', () => window.Filters.set({ dateTo: toEl.value }));
    catEl.addEventListener('change', () => window.Filters.set({ category: catEl.value }));
    statusEl.addEventListener('change', () => window.Filters.set({ status: statusEl.value }));
    $('#resetFiltersBtn').addEventListener('click', () => {
      fromEl.value = ''; toEl.value = ''; catEl.value = ''; statusEl.value = '';
      window.Filters.reset();
    });

    // Re-render data views whenever filters change.
    window.Filters.subscribe(() => {
      if (currentView === 'overview' || window.Store.getCategory(currentView)) {
        window.Charts.destroyAll();
        render();
      }
    });

    // Re-render when store changes (e.g. cross-tab updates).
    window.Store.subscribe(() => updateStorageInfo());

    // Keyboard: Esc closes mobile nav
    document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#app').classList.remove('nav-open'); });
  }

  /* ---- Helpers ------------------------------------------------------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- Boot ---------------------------------------------------------- */
  function init() {
    buildCategoryNav();
    window.Filters.populateCategoryOptions($('#filterCategory'));
    wireGlobalControls();
    updateStorageInfo();

    // Auto-load embedded HTOM SR data on first run
    window.Store.preloadHTOM();

    navigate('overview');

    if (window.Store.isEmpty()) {
      setTimeout(() => Toast.show('Welcome! Upload CSVs to get started, or download a template from Settings.', null, 5200), 400);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
