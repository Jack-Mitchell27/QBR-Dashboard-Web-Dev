/* =============================================================
   export.js — consolidated CSV export + PDF report
   Exposes a global `Exporter` object.
   ============================================================= */
(function () {
  'use strict';

  const COLUMNS = ['Date', 'Category', 'Metric', 'Value', 'Target', 'Status', 'Version', 'CaseID', 'Owner', 'Notes'];

  /* ---- Consolidated CSV ---------------------------------------------- */
  function downloadConsolidatedCsv(rows) {
    const data = rows || window.Store.getAllRows();
    if (!data.length) { window.Toast && window.Toast.show('No data to export.', 'warn'); return; }

    const header = ['Source'].concat(COLUMNS);
    const records = data.map(r => {
      const o = { Source: r._categoryName || '' };
      COLUMNS.forEach(c => { o[c] = r[c] == null ? '' : r[c]; });
      return o;
    });

    const csv = window.Papa.unparse({ fields: header, data: records.map(r => header.map(h => r[h])) });
    triggerDownload(csv, 'text/csv;charset=utf-8;', filename('qbr-consolidated', 'csv'));
    window.Toast && window.Toast.show(`Exported ${data.length} rows to CSV`, 'success');
  }

  /* ---- PDF report ---------------------------------------------------- */
  function downloadPdfReport(context) {
    context = context || {};
    const JsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!JsPDFCtor) { window.Toast && window.Toast.show('PDF library not loaded.', 'error'); return; }

    const doc = new JsPDFCtor({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = margin;

    // Header band
    doc.setFillColor(11, 37, 65);
    doc.rect(0, 0, pageW, 70, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('Quarterly Business Review', margin, 34);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.setTextColor(199, 214, 230);
    const now = new Date();
    doc.text('Generated: ' + now.toLocaleString(), margin, 52);
    if (context.filterSummary) {
      doc.text('Filters: ' + context.filterSummary, margin, 64);
    }
    y = 92;

    // Summary KPIs
    const allRows = window.Store.getAllRows();
    const filtered = context.rows || allRows;
    const sc = window.Charts.statusCounts(filtered);
    doc.setTextColor(15, 27, 45);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Executive summary', margin, y); y += 8;

    const summaryBody = [
      ['Total data points', String(filtered.length)],
      ['Categories with data', String(window.Store.getCategories().filter(c => window.Store.getRows(c.id).length).length) + ' / ' + window.Store.getCategories().length],
      ['Red items', String(sc.red)],
      ['Amber items', String(sc.amber)],
      ['Green items', String(sc.green)]
    ];
    doc.autoTable({
      startY: y + 6,
      head: [['Metric', 'Value']],
      body: summaryBody,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [13, 110, 253], textColor: 255 },
      columnStyles: { 0: { cellWidth: 200 } },
      margin: { left: margin, right: margin }
    });
    y = doc.lastAutoTable.finalY + 20;

    // Per-category breakdown tables.
    window.Store.getCategories().forEach(cat => {
      const rows = (context.rows
        ? filtered.filter(r => r._categoryId === cat.id)
        : window.Store.getRows(cat.id).map(r => Object.assign({ _categoryId: cat.id }, r)));
      if (!rows.length) return;

      if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = margin; }

      const worst = window.Charts.worstStatus(rows);
      const dot = { red: [226, 35, 26], amber: [244, 161, 0], green: [26, 162, 96], none: [148, 163, 184] }[worst];
      doc.setFillColor(dot[0], dot[1], dot[2]);
      doc.circle(margin + 4, y - 4, 4, 'F');
      doc.setTextColor(15, 27, 45);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('  ' + cat.name + '  (' + rows.length + ' rows)', margin + 6, y);
      y += 6;

      const body = rows.slice(0, 40).map(r => [
        r.Date || '', r.Category || '', r.Metric || '',
        r.Value == null ? '' : String(r.Value),
        r.Status ? r.Status.toUpperCase() : '',
        r.Version || '', r.CaseID || ''
      ]);

      doc.autoTable({
        startY: y + 6,
        head: [['Date', 'Category', 'Metric', 'Value', 'Status', 'Version', 'Case ID']],
        body,
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
        headStyles: { fillColor: [11, 37, 65], textColor: 255 },
        margin: { left: margin, right: margin },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 4) {
            const v = String(data.cell.raw || '').toLowerCase();
            if (v === 'red') { data.cell.styles.textColor = [163, 20, 13]; data.cell.styles.fillColor = [253, 236, 236]; }
            else if (v === 'amber') { data.cell.styles.textColor = [138, 91, 0]; data.cell.styles.fillColor = [255, 246, 229]; }
            else if (v === 'green') { data.cell.styles.textColor = [15, 107, 64]; data.cell.styles.fillColor = [231, 247, 239]; }
          }
        }
      });
      y = doc.lastAutoTable.finalY + 18;
    });

    // Footer page numbers
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150);
      doc.text('QBR Dashboard · client-side report · page ' + i + ' of ' + pages,
        pageW - margin, doc.internal.pageSize.getHeight() - 14, { align: 'right' });
    }

    doc.save(filename('qbr-report', 'pdf'));
    window.Toast && window.Toast.show('PDF report generated', 'success');
  }

  /* ---- Helpers ------------------------------------------------------- */
  function triggerDownload(content, mime, name) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filename(base, ext) {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `${base}-${stamp}.${ext}`;
  }

  window.Exporter = { downloadConsolidatedCsv, downloadPdfReport };
})();
