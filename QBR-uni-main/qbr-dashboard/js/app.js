/* =============================================================
  app.js - bootstrap, routing, views, and wiring
  Depends on: Store, Parser, Charts, Tables, Filters, Upload,
  and Exporter.
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
  let focusBeforeNav = null;

  const VIEW_TITLES = {
    overview: ['Overview', 'Each category shown independently with its own metrics and status'],
    upload:   ['Upload Data', 'Import CSV files for each category; parsed locally in your browser'],
    settings: ['Settings', 'Schema reference, data management, and export options']
  };

  function navigate(view) {
    currentView = view;
    window.Charts.destroyAll();
    window.Tables.destroyAll();

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
    setNavOpen(false, false);
    $('#content').focus({ preventScroll: true });
  }

  /* ---- Master render dispatcher -------------------------------------- */
  function render() {
    const content = $('#content');
    const cat = window.Store.getCategory(currentView);
    try {
      if (currentView === 'overview') return renderOverview(content);
      if (currentView === 'upload') return window.Upload.renderUploadView(content, onDataChanged);
      if (currentView === 'settings') return renderSettings(content);
      if (cat) return renderCategory(content, cat);
      return renderOverview(content);
    } catch (e) {
      console.error('View rendering failed.', e);
      content.innerHTML = `
        <div class="empty" role="alert">
          <h3>This view could not be displayed</h3>
          <p>Your saved data has not been cleared. Reset the filters or reload the page and try again.</p>
          <button class="btn btn--primary" id="renderRetry">Retry</button>
        </div>`;
      $('#renderRetry').addEventListener('click', render);
      Toast.show('A display error occurred. Your saved data was not cleared.', 'error', 6000);
    }
  }

  /* ---- Accessible chart alternatives -------------------------------- */
  function chartDataTable(summary, caption, headers, bodyRows) {
    if (!bodyRows.length) return '';
    return `
      <details class="chart-data">
        <summary>${escapeHtml(summary)}</summary>
        <div class="chart-data__scroll">
          <table class="chart-data__table">
            <caption>${escapeHtml(caption)}</caption>
            <thead><tr>${headers.map(h => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead>
            <tbody>${bodyRows.map(row => `<tr>${row.map((cell, index) =>
              index === 0
                ? `<th scope="row">${escapeHtml(cell)}</th>`
                : `<td>${escapeHtml(cell)}</td>`
            ).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </details>`;
  }

  function trendChartDetails(series, categoryName) {
    const headers = ['Metric'].concat(series.labels);
    const bodyRows = series.datasets.map(dataset => [dataset.label].concat(
      dataset.data.map(value => value == null ? 'No record' : window.Charts.formatNumber(value))
    ));
    return chartDataTable(
      'View trend data as a table',
      categoryName + ' metric values by date. Metrics may use different units and are not combined.',
      headers,
      bodyRows
    );
  }

  function statusChartDetails(rows, categoryName) {
    const counts = window.Charts.statusCounts(rows);
    return chartDataTable(
      'View status data as a table',
      categoryName + ' traffic-light status distribution.',
      ['Status', 'Records'],
      [['Green', counts.green], ['Amber', counts.amber], ['Red', counts.red], ['No status', counts.none]]
    );
  }

  function latestChartDetails(latest, categoryName) {
    const bodyRows = latest.map(item => [
      item.label,
      window.Charts.formatNumber(item.value),
      item.unit || 'Not specified',
      item.date || 'Not specified',
      item.status || 'No status'
    ]);
    return chartDataTable(
      'View latest values as a table',
      'Latest recorded value for each ' + categoryName + ' metric; values are not totalled across periods.',
      ['Metric', 'Latest value', 'Unit', 'Date', 'Status'],
      bodyRows
    );
  }

  /* ---- Overview view ------------------------------------------------- */
  function renderOverview(content) {
    const cats = window.Store.getCategories();
    if (window.Store.isEmpty()) return renderEmptyState(content);

    // Each category is independent, so render its own panel with its own chart/summary.
    let panels = '';
    const catsWithData = [];
    const catsEmpty = [];

    cats.forEach(c => {
      const rows = window.Filters.apply(window.Store.getRows(c.id).map(r => Object.assign({ _categoryId: c.id }, r)));
      if (rows.length) catsWithData.push({ cat: c, rows });
      else catsEmpty.push(c);
    });

    catsWithData.forEach(({ cat, rows }, idx) => {
      const ts = window.Charts.timeSeriesByMetric(rows, 'Date');
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
              ${window.Store.isDemoData(cat.id) ? '<span class="status-pill status--demo"><span class="status-dot"></span>Demo data</span>' : ''}
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
              <div class="card__head"><span class="card__title">Trend</span><span class="muted">one line per metric; values are not combined</span></div>
              <div class="card__body card__body--chart"><canvas id="ovTrend_${cat.id}" role="img" aria-label="${escapeHtml(cat.name)} metric trends over time"></canvas></div>
              ${trendChartDetails(ts, cat.name)}
            </div>
            <div class="card card--span-4">
              <div class="card__head"><span class="card__title">Status</span></div>
              <div class="card__body card__body--chart"><canvas id="ovStatus_${cat.id}" role="img" aria-label="${escapeHtml(cat.name)} traffic-light status distribution"></canvas></div>
              ${statusChartDetails(rows, cat.name)}
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
          <div class="card cat-card cat-card--empty card--span-4" data-nav="${c.id}" role="button" tabindex="0" aria-label="Open ${escapeHtml(c.name)}">
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
      const ts = window.Charts.timeSeriesByMetric(rows, 'Date');
      const trendCanvas = $(`#ovTrend_${cat.id}`);
      const statusCanvas = $(`#ovStatus_${cat.id}`);
      if (ts.labels.length && ts.datasets.length && trendCanvas) {
        window.Charts.line(trendCanvas, 'ovTrend_' + cat.id, ts.labels, ts.datasets);
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
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(el.dataset.nav);
        }
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
    const metricsCount = new Set(rows.map(r => r.Metric)).size;
    const cases = new Set(rows.filter(r => r.CaseID).map(r => r.CaseID)).size;
    const ts = window.Charts.timeSeriesByMetric(rows, 'Date');
    const latest = window.Charts.latestByMetric(rows);

    content.innerHTML = `
      <div class="kpi-grid">
        ${kpiTile('Data points', rows.length, 'filtered records', window.Charts.worstStatus(rows))}
        ${kpiTile('Distinct metrics', metricsCount, 'tracked in this category', 'green')}
        ${kpiTile('Open cases / refs', cases, 'with a Case ID', cases ? 'amber' : 'green')}
        ${kpiTile('Status', `${sc.red}/${sc.amber}/${sc.green}`, 'red / amber / green', window.Charts.worstStatus(rows))}
      </div>

      <div class="card-grid" style="margin-bottom:18px">
        <div class="card card--span-8">
          <div class="card__head"><span class="card__title">${escapeHtml(cat.name)}: trend</span><span class="muted">one line per metric; values are not combined</span></div>
          <div class="card__body card__body--chart"><canvas id="catTrend" role="img" aria-label="${escapeHtml(cat.name)} metric trends over time"></canvas></div>
          ${trendChartDetails(ts, cat.name)}
        </div>
        <div class="card card--span-4">
          <div class="card__head"><span class="card__title">Status mix</span></div>
          <div class="card__body card__body--chart"><canvas id="catStatus" role="img" aria-label="${escapeHtml(cat.name)} traffic-light status distribution"></canvas></div>
          ${statusChartDetails(rows, cat.name)}
        </div>
        <div class="card card--span-12">
          <div class="card__head"><span class="card__title">Latest value by metric</span><span class="muted">most recent record; no period totals</span></div>
          <div class="card__body card__body--chart"><canvas id="catByMetric" role="img" aria-label="Latest recorded value for each ${escapeHtml(cat.name)} metric"></canvas></div>
          ${latestChartDetails(latest, cat.name)}
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
    if (ts.labels.length && ts.datasets.length) window.Charts.line($('#catTrend'), 'catTrend', ts.labels, ts.datasets);
    window.Charts.statusDoughnut($('#catStatus'), 'catStatus', rows);

    const mLabels = latest.map(item => item.label + (item.unit ? ' (' + item.unit + ')' : ''));
    const mValues = latest.map(item => item.value);
    const mColors = latest.map(item => window.Charts.STATUS_COLORS[item.status] || window.Charts.STATUS_COLORS.none);
    window.Charts.bar($('#catByMetric'), 'catByMetric', mLabels, [{ label: 'Latest value', data: mValues, backgroundColor: mColors }], { indexAxis: mLabels.length > 8 ? 'y' : 'x' });

    // Table
    window.Tables.render($('#catTable'), rows, { showCategory: false });

    $('#catClear').addEventListener('click', () => {
      if (!confirm('Clear all data for ' + cat.name + '?')) return;
      try {
        window.Store.clearCategory(cat.id);
        Toast.show(cat.name + ' cleared', 'warn');
        onDataChanged();
      } catch (e) { handleStoreError(e); }
    });
  }

  /* ---- Settings view ------------------------------------------------- */
  function renderSettings(content) {
    const schema = window.Store.SCHEMA;
    const updated = window.Store.getUpdatedAt();
    const sizeKB = window.Store.storageSizeKB();
    const demoActive = window.Store.isDemoData('htom');
    const htomHasData = window.Store.getRows('htom').length > 0;

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
          <span>${window.Store.totalRows().toLocaleString()} rows in localStorage · ~${sizeKB} KB · last updated ${updated ? new Date(updated).toLocaleString() : '-'}</span>
        </div>
        <button class="btn btn--danger" id="setClear">Clear all data</button>
      </div>

      <div class="setting-row">
        <div class="setting-row__text">
          <strong>Demonstration data</strong>
          <span>${demoActive ? 'The HTOM category currently contains clearly labelled demonstration data.' : htomHasData ? 'HTOM already contains imported data; clear it before loading the demo.' : 'Load an optional HTOM sample to explore the dashboard without importing a file.'}</span>
        </div>
        <button class="btn btn--ghost" id="setDemo" ${htomHasData && !demoActive ? 'disabled' : ''}>${demoActive ? 'Clear demo data' : 'Load demo data'}</button>
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
            status is auto-derived from <code>Value</code> vs <code>Target</code>. <code>CaseID</code> is ideal for tracking fixes like <code>TEST-CASE-001</code>.
          </p>
        </div>
      </div>

      <div class="section-head" style="margin-top:26px"><h2>Templates</h2><span class="muted">one per category</span></div>
      <div class="upload-grid" id="tplGrid"></div>
    `;

    $('#setCsv').addEventListener('click', () => window.Exporter.downloadConsolidatedCsv());
    $('#setPdf').addEventListener('click', exportPdf);
    $('#setClear').addEventListener('click', clearAllData);
    $('#setDemo').addEventListener('click', () => {
      try {
        if (demoActive) {
          window.Store.clearCategory('htom');
          Toast.show('HTOM demonstration data cleared', 'warn');
        } else {
          window.Store.loadDemoHTOM();
          Toast.show('HTOM demonstration data loaded', 'success');
        }
        onDataChanged();
      } catch (e) { handleStoreError(e); }
    });

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
           All parsing happens locally; your data never leaves this browser.</p>
        <div class="flex gap-8" style="justify-content:center">
          <button class="btn btn--primary" id="emptyUpload">Go to Upload</button>
          <button class="btn btn--ghost" id="emptyDemo">Load demo data</button>
          <button class="btn btn--ghost" id="emptySettings">View CSV schema</button>
        </div>
      </div>`;
    $('#emptyUpload').addEventListener('click', () => navigate('upload'));
    $('#emptyDemo').addEventListener('click', () => {
      try {
        window.Store.loadDemoHTOM();
        Toast.show('HTOM demonstration data loaded', 'success');
        onDataChanged();
      } catch (e) { handleStoreError(e); }
    });
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
      const isDemo = window.Store.isDemoData(c.id);
      const btn = document.createElement('button');
      btn.className = 'nav__item';
      btn.dataset.view = c.id;
      btn.innerHTML = `<span>${escapeHtml(c.name)}</span>
        <span class="nav__badge ${count ? '' : 'is-empty'}">${count || 0}</span>`;
      if (isDemo) btn.title = 'Contains demonstration data';
      btn.addEventListener('click', () => navigate(c.id));
      host.appendChild(btn);
    });
  }

  /* ---- Data change handler ------------------------------------------- */
  function onDataChanged() {
    window.Charts.destroyAll();
    window.Tables.destroyAll();
    buildCategoryNav();
    $$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === currentView));
    window.Filters.populateCategoryOptions($('#filterCategory'));
    updateDateBounds();
    updateStorageInfo();
    render();
  }

  function updateStorageInfo() {
    const info = $('#storageInfo');
    const updated = window.Store.getUpdatedAt();
    info.textContent = `${window.Store.totalRows().toLocaleString()} rows · ~${window.Store.storageSizeKB()} KB` +
      (updated ? ` · saved ${new Date(updated).toLocaleTimeString()}` : '');
  }

  function updateDateBounds() {
    const bounds = window.Filters.dataDateBounds();
    const fromEl = $('#filterDateFrom'), toEl = $('#filterDateTo');
    [fromEl, toEl].forEach(el => {
      if (!el) return;
      if (bounds.min) el.min = bounds.min; else el.removeAttribute('min');
      if (bounds.max) el.max = bounds.max; else el.removeAttribute('max');
    });
  }

  function handleStoreError(e) {
    console.error(e);
    Toast.show('Browser storage is full or unavailable. Existing saved data was preserved; export or clear older data and try again.', 'error', 7000);
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
    try {
      window.Store.clearAll();
      Toast.show('All data cleared', 'warn');
      onDataChanged();
    } catch (e) { handleStoreError(e); }
  }

  function setNavOpen(open, restoreFocus) {
    const app = $('#app');
    const toggle = $('#menuToggle');
    const backdrop = $('#navBackdrop');
    if (open) {
      focusBeforeNav = document.activeElement;
      app.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      backdrop.tabIndex = 0;
      const first = $('#nav').querySelector('button:not([disabled]), a[href]');
      if (first) first.focus();
    } else {
      app.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      backdrop.tabIndex = -1;
      if (restoreFocus && focusBeforeNav && typeof focusBeforeNav.focus === 'function') focusBeforeNav.focus();
      focusBeforeNav = null;
    }
  }

  /* ---- Wiring -------------------------------------------------------- */
  function wireGlobalControls() {
    // Static nav buttons (overview/upload/settings)
    $$('.nav__item[data-view]').forEach(btn => {
      if (['overview', 'upload', 'settings'].includes(btn.dataset.view)) {
        btn.addEventListener('click', () => navigate(btn.dataset.view));
      }
    });

    $('#menuToggle').addEventListener('click', () => setNavOpen(!$('#app').classList.contains('nav-open'), true));
    $('#navBackdrop').addEventListener('click', () => setNavOpen(false, true));
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
        window.Tables.destroyAll();
        render();
      }
    });

    // Keep storage details current after local state changes.
    window.Store.subscribe(() => updateStorageInfo());

    // Synchronise changes made in another tab using the same origin.
    window.addEventListener('storage', e => {
      if (e.key !== window.Store.STORAGE_KEY) return;
      window.Store.reload();
      onDataChanged();
      Toast.show('Dashboard data was refreshed from another tab.', null, 4500);
    });

    // Keyboard: Esc closes mobile nav
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#app').classList.contains('nav-open')) {
        e.preventDefault();
        setNavOpen(false, true);
        return;
      }
      if (e.key !== 'Tab' || !$('#app').classList.contains('nav-open') || window.innerWidth > 860) return;
      const focusable = $$('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])', $('#sidebar'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
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
    updateDateBounds();

    navigate('overview');

    const loadWarning = window.Store.getLoadWarning();
    if (loadWarning) {
      setTimeout(() => Toast.show(loadWarning, 'warn', 7500), 300);
    } else if (window.Store.isEmpty()) {
      setTimeout(() => Toast.show('Welcome! Upload CSVs to get started, or download a template from Settings.', null, 5200), 400);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
