/* =============================================================
   parser.js — CSV parsing (PapaParse) + validation + normalisation
   Exposes a global `Parser` object.
   All parsing happens locally in the browser.
   ============================================================= */
(function () {
  'use strict';

  const REQUIRED = window.Store.SCHEMA.required;
  const OPTIONAL = window.Store.SCHEMA.optional;
  const KNOWN = REQUIRED.concat(OPTIONAL);

  /* Normalise a header for tolerant matching: trims, lowercases, strips spaces/underscores. */
  function normaliseKey(k) {
    return String(k || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  // Map of normalised -> canonical column name.
  const CANON = {};
  KNOWN.forEach(c => { CANON[normaliseKey(c)] = c; });
  // A few friendly aliases.
  Object.assign(CANON, {
    [normaliseKey('caseid')]:    'CaseID',
    [normaliseKey('case id')]:   'CaseID',
    [normaliseKey('case')]:      'CaseID',
    [normaliseKey('rag')]:       'Status',
    [normaliseKey('ragstatus')]: 'Status',
    [normaliseKey('value')]:     'Value',
    [normaliseKey('amount')]:    'Value',
    [normaliseKey('subcategory')]: 'Category',
    [normaliseKey('sub category')]: 'Category'
  });

  function canonicalHeader(h) {
    const n = normaliseKey(h);
    return CANON[n] || String(h || '').trim();
  }

  /* Coerce a status value into red|amber|green (or '' if unknown). */
  function normaliseStatus(v) {
    if (v == null) return '';
    const s = String(v).trim().toLowerCase();
    if (!s) return '';
    if (['red', 'r', 'critical', 'crit', 'high', 'fail', 'failed'].includes(s)) return 'red';
    if (['amber', 'a', 'yellow', 'y', 'warn', 'warning', 'medium', 'at risk', 'atrisk'].includes(s)) return 'amber';
    if (['green', 'g', 'ok', 'good', 'healthy', 'pass', 'passed', 'low', 'on track', 'ontrack'].includes(s)) return 'green';
    return ''; // unknown -> let auto-derivation handle it
  }

  /* Parse a numeric value tolerantly ("1,234", "85%", "$1.2k", "-"). */
  function parseNumber(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim();
    if (s === '' || s === '-' || s === '—') return null;
    let mult = 1;
    if (/k$/i.test(s)) { mult = 1e3; s = s.replace(/k$/i, ''); }
    else if (/m$/i.test(s)) { mult = 1e6; s = s.replace(/m$/i, ''); }
    s = s.replace(/[$£€,%\s]/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n * mult : null;
  }

  /* Validate that the parsed header row contains all required columns. */
  function validateHeaders(fields) {
    const canonFields = (fields || []).map(canonicalHeader);
    const present = new Set(canonFields);
    const missing = REQUIRED.filter(r => !present.has(r));
    const unknown = (fields || []).filter(f => KNOWN.indexOf(canonicalHeader(f)) === -1);
    return { ok: missing.length === 0, missing, unknown, canonFields };
  }

  /* Normalise a single raw row (object keyed by original headers). */
  function normaliseRow(raw) {
    const row = {};
    Object.keys(raw).forEach(k => {
      const canon = canonicalHeader(k);
      row[canon] = raw[k];
    });

    const out = {
      Date: String(row.Date == null ? '' : row.Date).trim(),
      Category: String(row.Category == null ? '' : row.Category).trim(),
      Metric: String(row.Metric == null ? '' : row.Metric).trim(),
      Value: parseNumber(row.Value),
      Status: normaliseStatus(row.Status),
      Version: row.Version != null ? String(row.Version).trim() : '',
      CaseID: row.CaseID != null ? String(row.CaseID).trim() : '',
      Owner: row.Owner != null ? String(row.Owner).trim() : '',
      Target: parseNumber(row.Target),
      Notes: row.Notes != null ? String(row.Notes).trim() : ''
    };

    // Derive a status from Value vs Target when not explicitly provided.
    if (!out.Status && out.Target != null && out.Value != null) {
      const ratio = out.Target === 0 ? 1 : out.Value / out.Target;
      out.Status = ratio >= 1 ? 'green' : ratio >= 0.8 ? 'amber' : 'red';
    }
    return out;
  }

  /* Is a normalised row "empty" (skip blank trailing lines)? */
  function isBlank(row) {
    return !row.Date && !row.Category && !row.Metric && row.Value == null;
  }

  /**
   * Parse a File object. Returns a Promise resolving to:
   *   { ok, rows, validation:{missing,unknown}, stats:{total,kept,skipped}, errors }
   *
   * Reads the file as text first via FileReader, then parses the string.
   * This is more reliable than passing the File directly to PapaParse,
   * especially when opening index.html from file:// (no server).
   */
  function parseFile(file) {
    return new Promise((resolve) => {
      var reader = new FileReader();
      reader.onload = function (e) {
        var text = e.target.result;
        resolve(parseString(text));
      };
      reader.onerror = function () {
        resolve({
          ok: false, rows: [],
          validation: { missing: [], unknown: [] },
          stats: { total: 0, kept: 0, skipped: 0 },
          errors: ['Failed to read file. Check that the file is a valid .csv.']
        });
      };
      reader.readAsText(file);
    });
  }

  /** Parse a raw CSV string (used for re-imports / programmatic data). */
  function parseString(text) {
    // Strip UTF-8 BOM if present (common when CSV is saved from Excel).
    if (text && text.charCodeAt(0) === 0xFEFF) {
      text = text.substring(1);
    }

    // Detect RTF files (macOS TextEdit saves as RTF by default, even with .csv extension).
    if (text && text.trimStart().substring(0, 5) === '{\\rtf') {
      return {
        ok: false, rows: [],
        validation: { missing: ['Date', 'Category', 'Metric', 'Value'], unknown: [] },
        stats: { total: 0, kept: 0, skipped: 0 },
        errors: [
          'This file is in Rich Text Format (RTF), not CSV.',
          'If you used TextEdit: open the file, go to Format > Make Plain Text (Shift+Cmd+T), then save and re-upload.',
          'Alternatively, use Numbers, Excel, or VS Code to create your CSV.'
        ]
      };
    }

    var results = window.Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: function (h) { return String(h).trim(); }
    });
    return buildResult(results);
  }

  function buildResult(results) {
    const fields = (results.meta && results.meta.fields) || [];
    const validation = validateHeaders(fields);
    const errors = [];

    if (!validation.ok) {
      errors.push('Missing required column(s): ' + validation.missing.join(', '));
      return {
        ok: false, rows: [],
        validation: { missing: validation.missing, unknown: validation.unknown },
        stats: { total: (results.data || []).length, kept: 0, skipped: 0 },
        errors
      };
    }

    const rawRows = results.data || [];
    const rows = [];
    let skipped = 0;
    rawRows.forEach(r => {
      const norm = normaliseRow(r);
      if (isBlank(norm)) { skipped++; return; }
      rows.push(norm);
    });

    // Surface PapaParse parse errors (e.g. malformed quotes) as warnings.
    (results.errors || []).forEach(e => {
      if (e && e.message) errors.push('Row ' + (e.row != null ? e.row + 1 : '?') + ': ' + e.message);
    });

    return {
      ok: rows.length > 0,
      rows,
      validation: { missing: [], unknown: validation.unknown },
      stats: { total: rawRows.length, kept: rows.length, skipped },
      errors
    };
  }

  window.Parser = {
    parseFile,
    parseString,
    validateHeaders,
    normaliseStatus,
    parseNumber,
    canonicalHeader,
    REQUIRED, OPTIONAL
  };
})();
