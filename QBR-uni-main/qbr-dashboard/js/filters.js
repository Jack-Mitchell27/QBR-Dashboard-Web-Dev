/* =============================================================
   filters.js — global filter state + row filtering
   Exposes a global `Filters` object.
   ============================================================= */
(function () {
  'use strict';

  const state = { dateFrom: '', dateTo: '', category: '', status: '' };
  const listeners = new Set();

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

  function set(partial) { Object.assign(state, partial); emit(); }
  function get() { return Object.assign({}, state); }
  function reset() { state.dateFrom = ''; state.dateTo = ''; state.category = ''; state.status = ''; emit(); }
  function isActive() { return !!(state.dateFrom || state.dateTo || state.category || state.status); }

  /** Apply the active filters to an array of normalised rows. */
  function apply(rows) {
    return rows.filter(r => {
      if (state.dateFrom && (!r.Date || r.Date < state.dateFrom)) return false;
      if (state.dateTo && (!r.Date || r.Date > state.dateTo)) return false;
      if (state.category && r.Category !== state.category) return false;
      if (state.status && (r.Status || '') !== state.status) return false;
      return true;
    });
  }

  /** Populate the Category <select> from all distinct Category values. */
  function populateCategoryOptions(selectEl) {
    if (!selectEl) return;
    const set = new Set();
    window.Store.getAllRows().forEach(r => { if (r.Category) set.add(r.Category); });
    const current = selectEl.value;
    const opts = ['<option value="">All categories</option>']
      .concat(Array.from(set).sort().map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`));
    selectEl.innerHTML = opts.join('');
    if (current && set.has(current)) selectEl.value = current;
  }

  /** Derive sensible default date bounds from the data (min/max Date). */
  function dataDateBounds() {
    let min = null, max = null;
    window.Store.getAllRows().forEach(r => {
      if (!r.Date) return;
      if (min === null || r.Date < min) min = r.Date;
      if (max === null || r.Date > max) max = r.Date;
    });
    return { min, max };
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  window.Filters = {
    set, get, reset, isActive, apply,
    populateCategoryOptions, dataDateBounds, subscribe
  };
})();
