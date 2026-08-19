/* =============================================================
  tables.js - DataTables rendering + traffic-light formatting
   Exposes a global `Tables` object.
   ============================================================= */
(function () {
  'use strict';

  let seq = 0;
  const liveTables = {}; // tableId -> DataTable API

  function destroy(id) {
    if (!id || !liveTables[id]) return;
    try { liveTables[id].destroy(true); }
    catch (e) { console.warn('Failed to destroy DataTable ' + id, e); }
    delete liveTables[id];
  }

  function destroyAll() { Object.keys(liveTables).forEach(destroy); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statusPill(status) {
    const map = {
      red:   ['status--red', 'Red'],
      amber: ['status--amber', 'Amber'],
      green: ['status--green', 'Green']
    };
    const [cls, label] = map[status] || ['status--none', '-'];
    return `<span class="status-pill ${cls}"><span class="status-dot"></span>${label}</span>`;
  }

  function fmtValue(v) {
    if (v == null || v === '') return '<span class="muted">-</span>';
    if (typeof v === 'number') return v.toLocaleString();
    return escapeHtml(v);
  }

  /**
   * Render a DataTable of normalised rows into a container element.
   * Applies traffic-light row classes for conditional formatting.
   */
  function render(container, rows, opts) {
    opts = opts || {};
    if (container.dataset.tableId) destroy(container.dataset.tableId);
    const id = 'dt_' + (++seq);

    // Tear down any previous instance in this container.
    container.innerHTML = '';

    if (!rows || rows.length === 0) {
      container.innerHTML = '<div class="empty" style="padding:32px"><p class="muted mt-0">No rows match the current filters.</p></div>';
      return null;
    }

    const showCategoryCol = opts.showCategory;

    const head = [
      'Date',
      showCategoryCol ? 'Source' : null,
      'Category', 'Metric', 'Value',
      opts.showUnit !== false ? 'Unit' : null,
      opts.showTarget !== false ? 'Target' : null,
      opts.showDirection !== false ? 'Direction' : null,
      'Status', 'Version', 'Case ID',
      opts.showOwner !== false ? 'Owner' : null,
      opts.showNotes !== false ? 'Notes' : null
    ].filter(Boolean);

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    table.id = id;
    table.className = 'display compact';
    table.style.width = '100%';

    const thead = document.createElement('thead');
    thead.innerHTML = '<tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(r => {
      const tr = document.createElement('tr');
      if (r.Status) tr.className = 'row--' + r.Status;
      const cells = [];
      cells.push(escapeHtml(r.Date));
      if (showCategoryCol) cells.push(escapeHtml(r._categoryName || ''));
      cells.push(escapeHtml(r.Category));
      cells.push(escapeHtml(r.Metric));
      cells.push(fmtValue(r.Value));
      if (opts.showUnit !== false) cells.push(escapeHtml(r.Unit) || '<span class="muted">-</span>');
      if (opts.showTarget !== false) cells.push(fmtValue(r.Target));
      if (opts.showDirection !== false) cells.push(escapeHtml(r.Direction) || '<span class="muted">-</span>');
      cells.push(statusPill(r.Status));
      cells.push(r.Version ? `<span class="cell-version">${escapeHtml(r.Version)}</span>` : '<span class="muted">-</span>');
      cells.push(r.CaseID ? `<span class="cell-version">${escapeHtml(r.CaseID)}</span>` : '<span class="muted">-</span>');
      if (opts.showOwner !== false) cells.push(escapeHtml(r.Owner) || '<span class="muted">-</span>');
      if (opts.showNotes !== false) cells.push(escapeHtml(r.Notes) || '<span class="muted">-</span>');
      tr.innerHTML = cells.map(c => `<td>${c}</td>`).join('');
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);

    // Initialise DataTable.
    const api = window.jQuery(table).DataTable({
      order: [[0, 'desc']],
      pageLength: opts.pageLength || 10,
      lengthMenu: [[10, 25, 50, -1], [10, 25, 50, 'All']],
      autoWidth: false,
      deferRender: true,
      language: {
        search: '', searchPlaceholder: 'Search…',
        emptyTable: 'No data available',
        info: 'Showing _START_–_END_ of _TOTAL_',
        infoEmpty: 'No entries',
        lengthMenu: 'Show _MENU_'
      }
    });
    liveTables[id] = api;
    container.dataset.tableId = id;
    return api;
  }

  window.Tables = { render, destroy, destroyAll, statusPill, escapeHtml };
})();
