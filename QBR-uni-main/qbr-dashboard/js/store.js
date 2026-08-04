/* =============================================================
   store.js — central config + localStorage state management
   Exposes a global `Store` object.
   ============================================================= */
(function () {
  'use strict';

  const STORAGE_KEY = 'qbr_dashboard_state_v1';

  /* ---- The 8 QBR categories ------------------------------------------ */
  const CATEGORIES = [
    { id: 'asset_manager', name: 'Asset Manager',         desc: 'Asset inventory & lifecycle' },
    { id: 'htom',          name: 'HTOM',                  desc: 'High-Touch Operations Mgmt' },
    { id: 'cos',           name: 'COS',                   desc: 'Customer Outcomes / Success' },
    { id: 'tac',           name: 'TAC',                   desc: 'Technical Assistance Center' },
    { id: 'pro_services',  name: 'Professional Services', desc: 'PS engagements & delivery' },
    { id: 'services',      name: 'Services',              desc: 'Managed & support services' },
    { id: 'ea_onboarding', name: 'EA Onboarding',         desc: 'Enterprise Agreement onboarding' },
    { id: 'license',       name: 'License Consumption',   desc: 'Entitlement vs. consumption' }
  ];

  /* ---- Standardised CSV schema --------------------------------------- */
  // Required columns must be present for a file to be accepted.
  const SCHEMA = {
    required: ['Date', 'Category', 'Metric', 'Value'],
    // Optional (recommended) columns — used for richer features.
    optional: ['Status', 'Version', 'CaseID', 'Owner', 'Target', 'Notes'],
    // Column docs used in the Settings → Schema view.
    docs: [
      { col: 'Date',     required: true,  type: 'YYYY-MM-DD', desc: 'Reporting date for the metric (ISO 8601).' },
      { col: 'Category', required: true,  type: 'text',       desc: 'Sub-category / workstream label (e.g. "Backlog", "CSAT").' },
      { col: 'Metric',   required: true,  type: 'text',       desc: 'Name of the measured metric (e.g. "Open Cases").' },
      { col: 'Value',    required: true,  type: 'number',     desc: 'Numeric value for the metric.' },
      { col: 'Status',   required: false, type: 'red|amber|green', desc: 'Traffic-light status for conditional formatting.' },
      { col: 'Version',  required: false, type: 'text',       desc: 'Software/version reference (e.g. release train).' },
      { col: 'CaseID',   required: false, type: 'text',       desc: 'Case / bug reference for traceability (e.g. CSCvi23216).' },
      { col: 'Owner',    required: false, type: 'text',       desc: 'Responsible person or team.' },
      { col: 'Target',   required: false, type: 'number',     desc: 'Target/threshold value for the metric.' },
      { col: 'Notes',    required: false, type: 'text',       desc: 'Free-text commentary for the QBR narrative.' }
    ]
  };

  /* ---- Default empty state ------------------------------------------- */
  function emptyState() {
    const data = {};
    CATEGORIES.forEach(c => { data[c.id] = { rows: [], meta: null }; });
    return { version: 1, updatedAt: null, data };
  }

  let state = load();

  /* ---- Persistence --------------------------------------------------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      // Merge to guarantee all categories exist (forward-compatible).
      const base = emptyState();
      if (parsed && parsed.data) {
        CATEGORIES.forEach(c => {
          if (parsed.data[c.id]) base.data[c.id] = parsed.data[c.id];
        });
        base.updatedAt = parsed.updatedAt || null;
      }
      return base;
    } catch (e) {
      console.warn('Failed to load state, starting fresh.', e);
      return emptyState();
    }
  }

  function persist() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to persist state (quota?).', e);
      throw e;
    }
    emit();
  }

  /* ---- Pub/sub so views re-render on data changes -------------------- */
  const listeners = new Set();
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

  /* ---- Public data API ----------------------------------------------- */
  function getCategory(id) { return CATEGORIES.find(c => c.id === id) || null; }
  function getCategories() { return CATEGORIES.slice(); }
  function getRows(categoryId) { return (state.data[categoryId] && state.data[categoryId].rows) || []; }
  function getMeta(categoryId) { return (state.data[categoryId] && state.data[categoryId].meta) || null; }

  function getAllRows() {
    const out = [];
    CATEGORIES.forEach(c => {
      getRows(c.id).forEach(r => out.push(Object.assign({ _categoryId: c.id, _categoryName: c.name }, r)));
    });
    return out;
  }

  /**
   * Replace all rows for a category (used after a successful upload).
   * @param {string} categoryId
   * @param {Array<Object>} rows  normalised row objects
   * @param {Object} meta         { fileName, rowCount, importedAt }
   */
  function setCategoryData(categoryId, rows, meta) {
    if (!state.data[categoryId]) state.data[categoryId] = { rows: [], meta: null };
    state.data[categoryId].rows = rows;
    state.data[categoryId].meta = Object.assign(
      { rowCount: rows.length, importedAt: new Date().toISOString() },
      meta || {}
    );
    persist();
  }

  /** Append rows to an existing category (merge instead of replace). */
  function appendCategoryData(categoryId, rows, meta) {
    if (!state.data[categoryId]) state.data[categoryId] = { rows: [], meta: null };
    const existing = state.data[categoryId].rows || [];
    state.data[categoryId].rows = existing.concat(rows);
    state.data[categoryId].meta = Object.assign(
      {}, state.data[categoryId].meta || {},
      { rowCount: state.data[categoryId].rows.length, importedAt: new Date().toISOString() },
      meta || {}
    );
    persist();
  }

  function clearCategory(categoryId) {
    if (state.data[categoryId]) { state.data[categoryId] = { rows: [], meta: null }; persist(); }
  }

  function clearAll() { state = emptyState(); persist(); }

  function isEmpty() { return CATEGORIES.every(c => getRows(c.id).length === 0); }

  function totalRows() { return CATEGORIES.reduce((n, c) => n + getRows(c.id).length, 0); }

  function getUpdatedAt() { return state.updatedAt; }

  /** Approximate localStorage footprint for this app (in KB). */
  function storageSizeKB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '';
      return Math.round((raw.length / 1024) * 10) / 10;
    } catch (e) { return 0; }
  }

  /* ---- Embedded CSV templates (work from file:// with no server) ----- */
  const TPL_HEADER = 'Date,Category,Metric,Value,Target,Status,Version,CaseID,Owner,Notes';
  const TEMPLATES = {
    asset_manager: [
      TPL_HEADER,
      '2025-01-15,Inventory,Total Managed Assets,1280,1300,green,AM-7.2,,A. Khan,Quarterly asset census complete',
      '2025-02-15,Inventory,Total Managed Assets,1305,1300,green,AM-7.2,,A. Khan,Net new devices onboarded',
      '2025-03-15,Inventory,Total Managed Assets,1342,1300,green,AM-7.3,,A. Khan,Above target',
      '2025-01-15,Lifecycle,Assets Past End-of-Life,86,40,red,AM-7.2,CSCvi23216,R. Davies,Refresh programme required',
      '2025-02-15,Lifecycle,Assets Past End-of-Life,64,40,amber,AM-7.2,CSCvi23216,R. Davies,Refresh in progress',
      '2025-03-15,Lifecycle,Assets Past End-of-Life,38,40,green,AM-7.3,CSCvi23216,R. Davies,Target met after refresh',
      '2025-01-15,Compliance,Coverage Compliance %,92,95,amber,AM-7.2,,L. Owens,Two sites pending audit',
      '2025-02-15,Compliance,Coverage Compliance %,96,95,green,AM-7.2,,L. Owens,All sites audited',
      '2025-03-15,Compliance,Coverage Compliance %,98,95,green,AM-7.3,,L. Owens,Strong compliance position'
    ],
    htom: [
      TPL_HEADER,
      '2026-06-19,Cisco Catalyst Center,Smart Account User linkage to Catalyst Center,91,,red,,700567487,Daniel Hulme,Dev Team filed a new defect - call with TAC TL scheduled',
      '2026-06-19,ACI,Leaf failed to properly fail over traffic during upgrade,84,,red,,700595994,Eriwode Ajise,MW scheduled to reload leaf 208 again',
      '2026-06-19,Secure Firewall 7.6,IPv6 peering stuck in INIT/DROTHER since failover,42,,amber,,700780205,Paul White,MW to failover firewalls - pending TAC reply on defect',
      '2026-06-19,ISE 3.3,ISE Health check,11,,green,,700918897,Anthony Smith,Pending UoL feedback (email dated Jun 15)',
      '2026-06-19,Cisco Spaces,Controller showing Degraded in connector view,7,,green,,700931831,Barry Dean,TAC suggested updating VTY access-list for Connector IPs',
      '2026-06-19,Solution Support,Decommissioned machines create XDR incidents months after removal,57,,amber,,700714777,Rob Humby,Pending TAC update - HTOM has pinged TAC case owner',
      '2026-06-19,Secure Firewall 7.6,NOSRA Secure Firewall integration with Security Cloud,54,,amber,,700731839,Rob Humby,To be closed',
      '2026-06-19,Secure Firewall 7.7,FMC-Splunk eStreamer delays causing eventing issues,62,,red,,700692063,Jack Pennington,Webex call scheduled for Jun 16 11:00 BST',
      '2026-06-19,Secure Endpoint,CSE for Ubuntu 26.04,1,,amber,,700957442,Jack Pennington,Pending TAC feedback regarding new Ubuntu version 26.04'
    ],
    cos: [
      TPL_HEADER,
      '2025-01-31,Outcomes,Success Plan Milestones Met,7,10,amber,,,J. Reyes,On track for quarter',
      '2025-02-28,Outcomes,Success Plan Milestones Met,9,10,amber,,,J. Reyes,One milestone slipped',
      '2025-03-31,Outcomes,Success Plan Milestones Met,11,10,green,,,J. Reyes,All milestones met',
      '2025-01-31,Satisfaction,CSAT Score,4.1,4.3,amber,,,K. Lin,Survey response rate 62%',
      '2025-02-28,Satisfaction,CSAT Score,4.4,4.3,green,,,K. Lin,Improved support experience',
      '2025-03-31,Satisfaction,CSAT Score,4.6,4.3,green,,,K. Lin,Highest score this year',
      '2025-01-31,Health,Account Health Index,68,75,amber,,CSCvi51877,T. Nguyen,Usage dip flagged',
      '2025-02-28,Health,Account Health Index,73,75,amber,,CSCvi51877,T. Nguyen,Recovering',
      '2025-03-31,Health,Account Health Index,81,75,green,,,T. Nguyen,Healthy account'
    ],
    tac: [
      TPL_HEADER,
      '2025-01-31,Cases,Open Cases,42,30,red,,,Support Desk,Backlog above threshold',
      '2025-02-28,Cases,Open Cases,33,30,amber,,,Support Desk,Backlog reducing',
      '2025-03-31,Cases,Open Cases,24,30,green,,,Support Desk,Backlog under control',
      '2025-01-31,Cases,P1 Critical Cases,3,0,red,17.9.4,CSCvi23216,Tier 3,Critical software defect',
      '2025-02-28,Cases,P1 Critical Cases,1,0,amber,17.9.5,CSCvi23216,Tier 3,Fix in validation',
      '2025-03-31,Cases,P1 Critical Cases,0,0,green,17.9.5,CSCvi23216,Tier 3,Defect resolved in 17.9.5',
      '2025-01-31,Performance,Avg Resolution Time (hrs),36,24,red,,,Support Desk,SLA breach risk',
      '2025-02-28,Performance,Avg Resolution Time (hrs),27,24,amber,,,Support Desk,Improving',
      '2025-03-31,Performance,Avg Resolution Time (hrs),21,24,green,,,Support Desk,Within SLA',
      '2025-03-31,Performance,CSAT (TAC),4.5,4.2,green,,,Support Desk,Post-case survey'
    ],
    pro_services: [
      TPL_HEADER,
      '2025-01-31,Delivery,Active Engagements,6,6,green,,,PS Delivery,Steady delivery pipeline',
      '2025-02-28,Delivery,Active Engagements,7,6,green,,,PS Delivery,New engagement kicked off',
      '2025-03-31,Delivery,Active Engagements,8,6,green,,,PS Delivery,Strong demand',
      '2025-01-31,Delivery,Milestones On Schedule %,82,90,amber,,,PS Delivery,One project at risk',
      '2025-02-28,Delivery,Milestones On Schedule %,88,90,amber,,,PS Delivery,Recovering schedule',
      '2025-03-31,Delivery,Milestones On Schedule %,93,90,green,,,PS Delivery,Back on track',
      '2025-01-31,Financials,Backlog Revenue (k),420,400,green,,,Finance,Healthy backlog',
      '2025-02-28,Financials,Backlog Revenue (k),465,400,green,,,Finance,Pipeline growth',
      '2025-03-31,Financials,Backlog Revenue (k),510,400,green,,,Finance,Record backlog',
      '2025-03-31,Quality,Delivery CSAT,4.3,4.2,green,,,PS Delivery,Positive client feedback'
    ],
    services: [
      TPL_HEADER,
      '2025-01-31,Availability,Service Uptime %,99.92,99.9,green,,,Ops,Within SLA',
      '2025-02-28,Availability,Service Uptime %,99.87,99.9,amber,,CSCvi66301,Ops,Brief outage on 14th',
      '2025-03-31,Availability,Service Uptime %,99.95,99.9,green,,,Ops,Strong availability',
      '2025-01-31,Requests,Service Requests Closed,128,120,green,,,Service Desk,Steady throughput',
      '2025-02-28,Requests,Service Requests Closed,141,120,green,,,Service Desk,Higher volume handled',
      '2025-03-31,Requests,Service Requests Closed,135,120,green,,,Service Desk,Consistent delivery',
      '2025-01-31,SLA,SLA Compliance %,94,97,amber,,,Ops,Two SLAs missed',
      '2025-02-28,SLA,SLA Compliance %,96,97,amber,,,Ops,Improving',
      '2025-03-31,SLA,SLA Compliance %,98,97,green,,,Ops,Above target'
    ],
    ea_onboarding: [
      TPL_HEADER,
      '2025-01-31,Provisioning,Entitlements Activated %,55,70,red,EA-3.1,,Onboarding Team,Slow initial activation',
      '2025-02-28,Provisioning,Entitlements Activated %,72,70,green,EA-3.1,,Onboarding Team,Activation accelerated',
      '2025-03-31,Provisioning,Entitlements Activated %,88,70,green,EA-3.2,,Onboarding Team,Strong adoption',
      '2025-01-31,Enablement,Users Onboarded,310,500,red,,,Enablement,Behind schedule',
      '2025-02-28,Enablement,Users Onboarded,520,500,green,,,Enablement,Caught up to plan',
      '2025-03-31,Enablement,Users Onboarded,640,500,green,,,Enablement,Exceeded target',
      '2025-01-31,Readiness,Onboarding Tickets Open,18,5,red,,CSCvi74590,Onboarding Team,Config blockers',
      '2025-02-28,Readiness,Onboarding Tickets Open,7,5,amber,,CSCvi74590,Onboarding Team,Most blockers cleared',
      '2025-03-31,Readiness,Onboarding Tickets Open,3,5,green,,,Onboarding Team,Onboarding stabilised'
    ],
    license: [
      TPL_HEADER,
      '2025-01-31,Consumption,Licenses Consumed,820,1000,green,,,Licensing,Within entitlement',
      '2025-02-28,Consumption,Licenses Consumed,910,1000,amber,,,Licensing,Approaching cap',
      '2025-03-31,Consumption,Licenses Consumed,985,1000,red,,CSCvi90183,Licensing,Near entitlement limit',
      '2025-01-31,Entitlement,Total Entitlement,1000,1000,green,,,Licensing,Contracted entitlement',
      '2025-02-28,Entitlement,Total Entitlement,1000,1000,green,,,Licensing,No change',
      '2025-03-31,Entitlement,Total Entitlement,1000,1000,green,,,Licensing,Renewal discussion needed',
      '2025-01-31,Utilisation,Utilisation %,82,85,amber,,,Licensing,Headroom available',
      '2025-02-28,Utilisation,Utilisation %,91,85,amber,,,Licensing,Monitor growth',
      '2025-03-31,Utilisation,Utilisation %,98,85,red,,CSCvi90183,Licensing,True-up likely required'
    ]
  };

  /** Download a template CSV for a category (works from file://). */
  function downloadTemplate(categoryId) {
    const lines = TEMPLATES[categoryId];
    if (!lines) return;
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_' + categoryId + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** Pre-load HTOM with real SR data on first run (if empty). */
  function preloadHTOM() {
    if (getRows('htom').length > 0) return; // already has data
    var csv = TEMPLATES.htom.join('\n');
    var result = window.Parser && window.Parser.parseString ? window.Parser.parseString(csv) : null;
    if (result && result.ok && result.rows.length) {
      setCategoryData('htom', result.rows, { fileName: 'preloaded-sr-data', sourceCategory: 'htom' });
    }
  }

  // Expose
  window.Store = {
    STORAGE_KEY, SCHEMA,
    getCategories, getCategory,
    getRows, getMeta, getAllRows,
    setCategoryData, appendCategoryData,
    clearCategory, clearAll,
    isEmpty, totalRows, getUpdatedAt, storageSizeKB,
    downloadTemplate, preloadHTOM,
    subscribe
  };
})();
