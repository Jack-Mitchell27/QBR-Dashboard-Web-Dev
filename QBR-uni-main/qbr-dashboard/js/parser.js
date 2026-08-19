/* =============================================================
  parser.js - CSV parsing (PapaParse) + validation + normalisation
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
    [normaliseKey('sub category')]: 'Category',
    [normaliseKey('unit of measure')]: 'Unit',
    [normaliseKey('uom')]:       'Unit',
    [normaliseKey('better when')]: 'Direction'
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

  function normaliseDirection(v) {
    if (v == null) return '';
    const s = String(v).trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (!s) return '';
    if (['higher', 'high', 'up', 'increase', 'higher-is-better', 'maximize', 'maximise'].includes(s)) return 'higher';
    if (['lower', 'low', 'down', 'decrease', 'lower-is-better', 'minimize', 'minimise'].includes(s)) return 'lower';
    return '';
  }

  /* Parse a numeric value tolerantly ("1,234", "85%", "$1.2k", "-"). */
  function parseNumber(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim();
    if (s === '' || s === '-' || s === '\u2014') return null;
    let mult = 1;
    if (/k$/i.test(s)) { mult = 1e3; s = s.replace(/k$/i, ''); }
    else if (/m$/i.test(s)) { mult = 1e6; s = s.replace(/m$/i, ''); }
    s = s.replace(/[$£€,%\s]/g, '');
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return isFinite(n) ? n * mult : null;
  }

  function isValidIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const parts = value.split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return d.getUTCFullYear() === parts[0] && d.getUTCMonth() === parts[1] - 1 && d.getUTCDate() === parts[2];
  }

  function deriveStatus(value, target, direction) {
    if (value == null || target == null || !direction) return '';
    if (direction === 'higher') {
      if (target === 0) return value >= 0 ? 'green' : 'red';
      if (value >= target) return 'green';
      return value >= target * 0.8 ? 'amber' : 'red';
    }
    if (direction === 'lower') {
      if (target === 0) return value <= 0 ? 'green' : 'red';
      if (value <= target) return 'green';
      return value <= target * 1.25 ? 'amber' : 'red';
    }
    return '';
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
      Unit: row.Unit != null ? String(row.Unit).trim() : '',
      Direction: normaliseDirection(row.Direction),
      Status: normaliseStatus(row.Status),
      Version: row.Version != null ? String(row.Version).trim() : '',
      CaseID: row.CaseID != null ? String(row.CaseID).trim() : '',
      Owner: row.Owner != null ? String(row.Owner).trim() : '',
      Target: parseNumber(row.Target),
      Notes: row.Notes != null ? String(row.Notes).trim() : ''
    };

    // Direction is required for safe derivation: a blank direction must not
    // assume that a larger number always represents better performance.
    if (!out.Status) out.Status = deriveStatus(out.Value, out.Target, out.Direction);
    return out;
  }

  function canonicaliseRawRow(raw) {
    const row = {};
    Object.keys(raw || {}).forEach(k => { row[canonicalHeader(k)] = raw[k]; });
    return row;
  }

  function validateRow(row, raw, rowNumber) {
    const source = canonicaliseRawRow(raw);
    const errors = [];
    const prefix = 'Row ' + rowNumber + ': ';
    if (!row.Date) errors.push(prefix + 'Date is required.');
    else if (!isValidIsoDate(row.Date)) errors.push(prefix + 'Date must be a real date in YYYY-MM-DD format.');
    if (!row.Category) errors.push(prefix + 'Category is required.');
    if (!row.Metric) errors.push(prefix + 'Metric is required.');
    if (row.Value == null) errors.push(prefix + 'Value must be a valid number.');
    if (source.Target != null && String(source.Target).trim() !== '' && row.Target == null) {
      errors.push(prefix + 'Target must be a valid number when supplied.');
    }
    if (source.Status != null && String(source.Status).trim() !== '' && !normaliseStatus(source.Status)) {
      errors.push(prefix + 'Status must be red, amber or green (or a supported synonym).');
    }
    if (source.Direction != null && String(source.Direction).trim() !== '' && !row.Direction) {
      errors.push(prefix + 'Direction must be higher or lower.');
    }
    return errors;
  }

  /* Is a normalised row "empty" (skip blank trailing lines)? */
  function isBlank(row, raw) {
    return Object.keys(raw || {}).every(key => String(raw[key] == null ? '' : raw[key]).trim() === '');
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
          validation: { missing: [], unknown: [], rowErrors: [] },
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
        validation: { missing: ['Date', 'Category', 'Metric', 'Value'], unknown: [], rowErrors: [] },
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
        validation: { missing: validation.missing, unknown: validation.unknown, rowErrors: [] },
        stats: { total: (results.data || []).length, kept: 0, skipped: 0 },
        errors
      };
    }

    const rawRows = results.data || [];
    const rows = [];
    const rowErrors = [];
    let skipped = 0;
    rawRows.forEach((r, index) => {
      const norm = normaliseRow(r);
      if (isBlank(norm, r)) { skipped++; return; }
      const validationErrors = validateRow(norm, r, index + 2);
      if (validationErrors.length) rowErrors.push.apply(rowErrors, validationErrors);
      else rows.push(norm);
    });

    // Surface PapaParse parse errors (e.g. malformed quotes) as warnings.
    (results.errors || []).forEach(e => {
      if (e && e.message) errors.push('Row ' + (e.row != null ? e.row + 1 : '?') + ': ' + e.message);
    });

    if (rowErrors.length) {
      errors.push.apply(errors, rowErrors);
      return {
        ok: false, rows: [],
        validation: { missing: [], unknown: validation.unknown, rowErrors },
        stats: { total: rawRows.length, kept: 0, valid: rows.length, skipped },
        errors
      };
    }

    if (rows.length === 0) errors.push('No valid data rows were found.');

    return {
      ok: rows.length > 0,
      rows,
      validation: { missing: [], unknown: validation.unknown, rowErrors: [] },
      stats: { total: rawRows.length, kept: rows.length, skipped },
      errors
    };
  }

  window.Parser = {
    parseFile,
    parseString,
    validateHeaders,
    normaliseStatus,
    normaliseDirection,
    parseNumber,
    isValidIsoDate,
    deriveStatus,
    normaliseRow,
    validateRow,
    canonicalHeader,
    REQUIRED, OPTIONAL
  };
})();
