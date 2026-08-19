/* =============================================================
  upload.js - drag & drop multi-category CSV upload UI
   Exposes a global `Upload` object with renderUploadView().
   ============================================================= */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Render the full Upload view into a container element. */
  function renderUploadView(container, onChange) {
    const cats = window.Store.getCategories();

    container.innerHTML = `
      <div class="section-head">
        <h2>Upload data</h2>
        <span class="muted">Drag &amp; drop a CSV onto a category, or browse. Files are parsed in your browser; nothing is uploaded.</span>
        <div class="section-head__spacer"></div>
        <button class="btn btn--ghost btn--sm" id="appendToggle" title="When on, new files are added to existing rows instead of replacing them">Mode: Replace</button>
      </div>
      <div class="upload-grid" id="uploadGrid"></div>
    `;

    const grid = container.querySelector('#uploadGrid');
    let appendMode = false;

    const appendBtn = container.querySelector('#appendToggle');
    appendBtn.addEventListener('click', () => {
      appendMode = !appendMode;
      appendBtn.textContent = 'Mode: ' + (appendMode ? 'Append' : 'Replace');
      appendBtn.classList.toggle('btn--primary', appendMode);
      appendBtn.classList.toggle('btn--ghost', !appendMode);
    });

    cats.forEach(cat => grid.appendChild(buildDropzone(cat, () => appendMode, onChange)));
  }

  function buildDropzone(cat, getAppendMode, onChange) {
    const meta = window.Store.getMeta(cat.id);
    const rowCount = window.Store.getRows(cat.id).length;

    const zone = document.createElement('div');
    zone.className = 'dropzone';
    zone.dataset.category = cat.id;
    zone.innerHTML = `
      <div class="dropzone__head">
        <div>
          <div class="dropzone__title">${escapeHtml(cat.name)}</div>
          <div class="dropzone__hint">${escapeHtml(cat.desc)}</div>
        </div>
      </div>
      <label class="dropzone__cta">
        <input type="file" accept=".csv,text/csv" class="hidden file-input" aria-label="Choose ${escapeHtml(cat.name)} CSV files" />
        <span>Drop CSV here or <u>browse</u></span>
      </label>
      <div class="dropzone__meta">
        ${meta && rowCount
          ? `<span class="status-pill status--green"><span class="status-dot"></span>${rowCount} rows</span>
             <span class="muted" style="font-size:12px">${escapeHtml(meta.fileName || 'imported')}</span>`
          : `<span class="status-pill status--none"><span class="status-dot"></span>No data</span>`}
      </div>
      <div class="dropzone__status" role="status"></div>
      <div class="validation"></div>
      <div class="dropzone__meta" style="margin-top:10px">
        <button class="btn btn--ghost btn--sm template-link">Template</button>
        ${rowCount ? '<button class="btn btn--ghost btn--sm clear-cat">Clear</button>' : ''}
      </div>
    `;

    const input = zone.querySelector('.file-input');
    const statusEl = zone.querySelector('.dropzone__status');
    const validationEl = zone.querySelector('.validation');
    const clearBtn = zone.querySelector('.clear-cat');
    const tplBtn = zone.querySelector('.template-link');

    tplBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.Store.downloadTemplate(cat.id);
    });

    function handleFiles(fileList) {
      const files = Array.from(fileList || []).filter(f => /\.csv$/i.test(f.name) || f.type === 'text/csv');
      if (files.length === 0) {
        setStatus('err', 'Please drop a .csv file.');
        return;
      }
      // Process sequentially; if append mode is off, the first file replaces.
      processSequential(files, 0, getAppendMode());
    }

    function processSequential(files, index, append) {
      if (index >= files.length) return;
      const file = files[index];
      setStatus('', 'Parsing ' + file.name + '…');
      validationEl.innerHTML = '';

      window.Parser.parseFile(file).then(result => {
        if (!result.ok) {
          renderValidation(result);
          setStatus('err', '✗ ' + file.name + ' rejected.');
          window.Toast && window.Toast.show('“' + file.name + '” failed validation for ' + cat.name, 'error');
          return;
        }

        const useAppend = append || index > 0; // subsequent files in a multi-drop append
        const metaObj = { fileName: file.name, sourceCategory: cat.id, isDemo: false };
        try {
          if (useAppend) window.Store.appendCategoryData(cat.id, result.rows, metaObj);
          else window.Store.setCategoryData(cat.id, result.rows, metaObj);
        } catch (e) {
          console.error(e);
          setStatus('err', 'Could not save ' + file.name + ' in browser storage. Export or clear older data and try again.');
          window.Toast && window.Toast.show('Browser storage is full or unavailable. Existing saved data was preserved.', 'error', 7000);
          return;
        }

        renderValidation(result);
        const total = window.Store.getRows(cat.id).length;
        setStatus('ok', `✓ Imported ${result.stats.kept} rows from ${file.name} (${total} total).`);
        window.Toast && window.Toast.show(`Imported ${result.stats.kept} rows into ${cat.name}`, 'success');

        if (typeof onChange === 'function') onChange();
        // Continue to next file (force append for the rest).
        processSequential(files, index + 1, true);
      });
    }

    function renderValidation(result) {
      const parts = [];
      if (result.validation.missing && result.validation.missing.length) {
        parts.push(`<div class="validation__err"><strong>Missing required column(s):</strong> ${escapeHtml(result.validation.missing.join(', '))}.<br>Required: ${escapeHtml(window.Parser.REQUIRED.join(', '))}.</div>`);
      }
      if (result.validation.unknown && result.validation.unknown.length) {
        parts.push(`<div class="validation__warn">Ignored unknown column(s): ${escapeHtml(result.validation.unknown.join(', '))}.</div>`);
      }
      if (result.stats && result.stats.skipped) {
        parts.push(`<div class="validation__warn">Skipped ${result.stats.skipped} blank row(s).</div>`);
      }
      if (result.errors && result.errors.length) {
        const cls = result.ok ? 'validation__warn' : 'validation__err';
        const shown = result.errors.slice(0, 8);
        const more = result.errors.length > shown.length ? ` · ${result.errors.length - shown.length} more issue(s)` : '';
        parts.push(`<div class="${cls}">${escapeHtml(shown.join(' · ') + more)}</div>`);
      }
      validationEl.innerHTML = parts.join('');
    }

    function setStatus(kind, msg) {
      statusEl.className = 'dropzone__status' + (kind ? ' ' + kind : '');
      statusEl.textContent = msg;
    }

    input.addEventListener('change', e => handleFiles(e.target.files));

    ['dragenter', 'dragover'].forEach(ev =>
      zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('is-dragover'); }));
    ['dragleave', 'drop'].forEach(ev =>
      zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('is-dragover'); }));
    zone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      if (dt && dt.files) handleFiles(dt.files);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!confirm('Clear all imported data for ' + cat.name + '?')) return;
        try {
          window.Store.clearCategory(cat.id);
          window.Toast && window.Toast.show(cat.name + ' data cleared', 'warn');
          if (typeof onChange === 'function') onChange();
        } catch (e) {
          console.error(e);
          window.Toast && window.Toast.show('Could not update browser storage. Existing saved data was preserved.', 'error');
        }
      });
    }

    return zone;
  }

  window.Upload = { renderUploadView };
})();
