# QBR Dashboard

An interactive **Quarterly Business Review** dashboard built with **vanilla HTML, CSS, and JavaScript**. It parses CSV files entirely in your browser, visualises them with charts and traffic‑light tables, and persists everything in `localStorage`.

> **Security note:** All CSV processing is **100% client-side**. Your data never leaves your machine; nothing is uploaded to any server. This makes the tool suitable for secure / sensitive environments.

> **Offline-ready:** All libraries (Chart.js, DataTables, jQuery, PapaParse, jsPDF) are **bundled locally** in `vendor/`. No internet connection is required to run the dashboard.

---

## Features

- **8 category modules:** Asset Manager, HTOM, COS, TAC, Professional Services, Services, EA Onboarding, License Consumption.
- **Drag‑and‑drop CSV upload** per category (powered by [PapaParse](https://www.papaparse.com/)).
- **Validation Check:** a file is **rejected** with a clear message if it’s missing a required column, *before* any chart renders.
- **Traffic-light status** (Red / Amber / Green) with conditional row formatting in tables and KPI tiles.
- **Charts** with hover tooltips ([Chart.js](https://www.chartjs.org/)): trends, status mix, by-category and by-metric breakdowns.
- **Interactive tables** ([DataTables](https://datatables.net/)) with search, sort, and pagination.
- **Filters:** Date range, Category, and Status, applied across the whole dashboard.
- **State persistence:** your uploads survive a page refresh (`localStorage`).
- **Exports:** one **consolidated CSV** and a formatted **PDF report** ([jsPDF](https://github.com/parallax/jsPDF)).
- **Clear Data:** reset a single category or wipe everything.
- **Responsive:** collapsible sidebar layout that works on desktop, tablet, and mobile.
- **Version / Case ID tracking:** track fixes like `TEST-CASE-001` over time.

---

## Running locally in VS Code

The app is fully static, with **no build step required**. Because it loads category templates and uses local library files, you should serve it over HTTP (don’t just double-click `index.html`).

### Easiest: double-click launcher (for non-technical recipients)
- **macOS:** double‑click `start-mac.command`
- **Windows:** double‑click `start-windows.bat`
- **Linux:** run `./start-linux.sh`

Each script starts a local server and opens your browser automatically. See `QUICK-START.md` for a recipient‑friendly guide.

### Option A: Live Server extension (recommended in VS Code)
1. Open this folder in VS Code (**File → Open Folder…**).
2. When prompted, install the recommended extension **Live Server** (`ritwickdey.liveserver`), or install it manually from the Extensions view.
3. Right‑click `index.html` → **Open with Live Server**.
4. Your browser opens at something like `http://127.0.0.1:5500/`.

### Option B: Python (built-in on macOS)
```bash
cd qbr-dashboard
python3 -m http.server 5500
```
Then open <http://localhost:5500> in your browser.

### Option C: Node
```bash
cd qbr-dashboard
npx serve -l 5500
```

> An internet connection is **not** required. Chart.js, DataTables, PapaParse, and jsPDF are bundled in `vendor/`, and your data is processed locally.

---

## Project structure

```
qbr-dashboard/
├── index.html              # App shell: sidebar + main content
├── css/
│   └── styles.css          # Cisco-inspired theme, responsive, traffic-light tokens
├── js/
│   ├── store.js            # Category config + CSV schema + localStorage state
│   ├── parser.js           # PapaParse wrapper, validation + row normalisation
│   ├── charts.js           # Chart.js renderers + aggregation helpers
│   ├── tables.js           # DataTables rendering + conditional formatting
│   ├── filters.js          # Date / Category / Status filter logic
│   ├── upload.js           # Drag-and-drop multi-category upload UI
│   ├── export.js           # Consolidated CSV + PDF report
│   └── app.js              # Routing, views, and wiring (bootstrap)
├── vendor/                 # Bundled libraries (offline): Chart.js, DataTables, jQuery, PapaParse, jsPDF
├── start-mac.command       # Double-click launcher (macOS)
├── start-windows.bat       # Double-click launcher (Windows)
├── start-linux.sh          # Launcher (Linux)
├── tests/                  # Dependency-free Node.js regression tests + fixtures
├── package.json            # Test commands (no runtime package install required)
├── TESTING.md              # Test strategy, results, defects and remaining validation
├── QUICK-START.md          # Recipient-friendly guide
└── README.md
```

---

## CSV schema

Every category uses the **same standardised template**, so data aggregates consistently.

| Column     | Required | Type / format            | Description |
|------------|----------|--------------------------|-------------|
| `Date`     | **Yes**  | `YYYY-MM-DD`             | Reporting date for the metric (ISO 8601). |
| `Category` | **Yes**  | text                     | Sub‑category / workstream label (e.g. `Backlog`, `CSAT`). |
| `Metric`   | **Yes**  | text                     | Name of the measured metric (e.g. `Open Cases`). |
| `Value`    | **Yes**  | number                   | Numeric value (supports `1,234`, `85%`, `1.2k`). |
| `Unit`     | No       | text                     | Unit of measure (for example `count`, `%`, `hours`). |
| `Direction`| No       | `higher` \| `lower`       | Whether higher or lower values represent better performance. |
| `Status`   | No       | `red` \| `amber` \| `green` | Traffic‑light status. RAG synonyms accepted. |
| `Version`  | No       | text                     | Software / release reference. |
| `CaseID`   | No       | text                     | Case / bug reference for traceability (e.g. `TEST-CASE-001`). |
| `Owner`    | No       | text                     | Responsible person or team. |
| `Target`   | No       | number                   | Target / threshold for the metric. |
| `Notes`    | No       | text                     | Free‑text commentary for the QBR narrative. |

### Rules & conveniences
- **Required columns** (`Date`, `Category`, `Metric`, `Value`) must all be present, or the file is rejected with a validation message.
- **Header matching is tolerant:** case/spacing is ignored, and aliases like `Case ID`, `RAG`, `Amount`, `Sub Category` are mapped automatically.
- **Auto status**: status is derived only when `Status`, `Target`, and a valid `Direction` rule are available. For `higher`, meeting target is Green and 80–99.9% is Amber. For `lower`, meeting or beating target is Green and up to 125% of target is Amber. A blank direction deliberately leaves status unclassified rather than assuming that higher is always better.
- **Unknown columns** are ignored (with a non‑blocking warning); **blank rows** are skipped.
- **Invalid rows are rejected before saving:** required values, real ISO dates, numeric values/targets, statuses and directions are checked with row-specific feedback.

### Example
```csv
Date,Category,Metric,Value,Unit,Target,Direction,Status,Version,CaseID,Owner,Notes
2025-03-31,Cases,P1 Critical Cases,0,count,0,lower,green,17.9.5,TEST-CASE-001,Tier 3,Defect resolved in 17.9.5
```

Ready-to-edit templates are embedded in the application so they also work offline. Download each one from **Upload Data** or **Settings**.

---

## Using the dashboard

1. **Upload Data** tab → drag a CSV onto the matching category card (or click **browse**).
   - Toggle **Replace / Append** to control whether new files overwrite or add to existing rows.
2. **Overview** → consolidated KPIs, trend, status mix, and a card per category (click to drill in).
3. **Category views** → KPIs, trend, by‑metric chart, and a detailed traffic‑light table.
4. **Filters** (top bar) → narrow by Date range, Category, or Status; everything re‑renders live.
5. **Exports** (top bar / Settings) → **CSV** (consolidated) or **Report (PDF)**.
6. **Settings** → schema reference, template downloads, and **Clear all data**.
7. Optional: choose **Load demo data** from the empty state or Settings. Demonstration data is opt-in and visibly labelled.

---

## Tech & libraries

| Concern        | Bundled library        |
|----------------|----------------------|
| CSV parsing    | PapaParse 5.4.1      |
| Charts         | Chart.js 4.4.1       |
| Tables         | DataTables 1.13.8 (+ jQuery 3.7.1) |
| PDF export     | jsPDF 2.5.1 + jspdf‑autotable 3.8.2 |

No framework and no bundler; just open and run.

> **Backup note:** Browser storage is device/profile-specific and is not encrypted. Export a consolidated CSV before clearing browser data, changing device, or importing unusually large datasets.

---

## Testing

With Node.js 20 or later installed, run:

```bash
npm test
```

The suite uses Node's built-in test runner and requires no package download. It covers parser validation, direction-aware status, metric-separated chart data, filters, transactional browser storage, backup recovery and export safety/completeness. See [TESTING.md](TESTING.md) for executed browser scenarios, corrected defects and outstanding environment validation. The submission narrative, references, reflection, user-testing limitation and expanded QA evidence are indexed in [docs/portfolio/README.md](docs/portfolio/README.md).

---

## Troubleshooting

- **A file was rejected** → check the validation message; it lists exactly which required column is missing. Compare against the template.
- **Charts/tables don’t appear** → ensure you’re serving over HTTP (Options A–C), not opening the file directly. Check the browser console for blocked CDN requests if you’re offline.
- **Template download opens text instead of saving** → some browsers preview CSVs; use right‑click → *Save link as…*, or download from the **Settings** tab.
- **Reset everything** → **Settings → Clear all data** (irreversible).
