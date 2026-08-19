# QBR Dashboard: Testing and Quality Assurance Evidence

**Test date:** 18 August 2026
**Stage:** Regression, system, compatibility and accessibility QA
**Local environment:** macOS, Node.js 22.14.0, integrated Chromium browser
**Application build:** static client-side build, script revision 9

## 1. Scope

This report records repeatable evidence for parser validation, metric calculations, filtering, browser storage, exports, navigation, accessibility behaviour and core end-to-end views. Representative-user testing could not be completed because suitable participant access was unavailable, so no user-validation claim is made. The report also does not claim a complete cross-browser matrix or organisational security approval.

## 2. Automated regression suite

Run from the dashboard directory with `npm test`. The suite uses the Node.js built-in test runner and has no third-party test dependency.

**Latest result:** 20 tests passed, 0 failed, 0 skipped.

| Area | Verified behaviour |
|---|---|
| CSV parser | Valid import, missing headers, real ISO dates, numeric values/targets, status/direction validation, direction-aware thresholds, zero targets, blank direction, tolerant numbers and RTF rejection |
| Chart data | Unlike metrics remain separate, duplicate metric/date rows are not invented into totals, latest values use the latest date, RAG counts and worst status |
| Filters | Inclusive date boundaries, combined category/status filters and reset |
| Storage | Eight-category initial state, persistence, transaction rollback on quota failure, corrupt-primary backup recovery, durable primary repair and clear-all cleanup |
| Export | Unit/Direction columns, spreadsheet-formula neutralisation and all supplied rows included in the PDF body |

Fixtures are stored in [tests/fixtures](tests/fixtures) and tests are stored in [tests](tests).

## 3. Browser integration results

| ID | Scenario | Expected | Actual result | Status |
|---|---|---|---|---|
| BI-01 | Load overview with existing HTOM records | App loads without runtime error | Overview loaded; no page or console errors captured | Pass |
| BI-02 | Open Upload Data | Eight category dropzones with labelled inputs | Eight dropzones and eight labelled file controls | Pass |
| BI-03 | Open Settings | Complete schema and template actions | Twelve schema rows and eight template buttons | Pass |
| BI-04 | Open HTOM detail | KPI, three charts and DataTable render | Three charts, nine metric datasets/bars and a 12-column table rendered | Pass |
| BI-05 | Apply red-status filter | Only red HTOM rows remain | Table reduced from nine rows to three red rows | Pass |
| BI-06 | Import invalid fixture | Reject before persistence with row reasons | Invalid date, value, target and direction reported; zero rows stored | Pass |
| BI-07 | Import valid Direction fixture | Store two rows and derive lower-is-better status safely | Two rows stored temporarily with statuses red/green and `lower` direction | Pass |
| BI-08 | Empty first run | No automatic customer-like sample data | Empty state displayed with explicit Load demo data action | Pass |
| BI-09 | Opt into demo | Load and label the sample deliberately | Nine HTOM rows loaded with `isDemo=true` and visible Demo data label | Pass |
| BI-10 | Mobile menu | Correct expanded state, focus entry and close behaviour | `aria-expanded` changed, focus moved to Overview, backdrop closed menu and focus returned | Pass |
| BI-11 | Skip navigation | Link targets main content | Link activation changed target to `#content` | Pass |
| BI-12 | Mixed-value summary | Do not show a total across incompatible units | Total Value tile absent; Data points used instead | Pass |
| BI-13 | Metric trends | Do not sum unlike metrics into one trend | One dataset per subcategory/metric; nine datasets for HTOM | Pass |
| BI-14 | PDF mapping | Do not silently limit category detail to 40 rows | Automated helper test retained all 45 supplied rows | Pass |
| BI-15 | Chart alternatives | Expose chart values without relying on canvas pixels | HTOM rendered three named canvases and three adjacent expandable semantic data tables | Pass |

Temporary browser-import and demo tests restored the original browser storage after each scenario.

## 4. Defects corrected during this test cycle

| Defect | Risk | Resolution |
|---|---|---|
| Invalid dates and values were accepted | Incorrect filters and KPIs | Added row-level blocking validation with CSV row numbers |
| Status assumed higher values were always better | Incorrect RAG decisions | Added explicit `Direction` and no derivation without a valid rule |
| Positive values against zero lower-is-better targets became green | False success status | Zero target now returns red unless the lower-is-better value is zero or below |
| Trends and Total Value combined incompatible units | Misleading analytics | Removed mixed total; separated trends and latest metric values |
| PDF silently stopped at 40 rows per category | Incomplete report | Removed the limit and regression-tested complete body mapping |
| DataTables were retained after re-render | Long-session memory/stale-state risk | Added per-table and global teardown |
| Storage failure could leave unsaved in-memory changes | Data-loss/confusion risk | Added transactional state updates, rollback and recovery guidance |
| Corrupt local state silently reset | Unexplained data disappearance | Added previous-state backup recovery and visible startup warning |
| Backup recovery existed only in memory | The next load could encounter the same corrupt primary value | Recovery now rewrites the primary storage key immediately where storage permits; the store test re-parses and verifies that repaired value |
| Demo HTOM data loaded automatically | Demo/live data confusion | Made demo opt-in and visibly labelled |
| Mobile navigation lacked state/focus management | Keyboard accessibility barrier | Added expanded state, focus entry/trap/return and backdrop close control |
| Canvas charts lacked equivalent data access | Chart values unavailable to some assistive-technology users | Added accessible canvas names and captioned trend/status/latest-value data tables |

## 5. High-value evidence notes

### Strict invalid import

The invalid fixture contains an impossible date, non-numeric value, invalid target and unsupported Direction. The browser reported all four row-level reasons and persisted zero rows. This demonstrates file-level atomicity rather than a partial import.

### Direction and zero target

The valid Direction fixture imported two lower-is-better rows against a zero target. A positive value derived red and a zero value derived green. Equivalent threshold and blank-direction boundaries are covered by the parser regression suite.

### Durable backup recovery

The storage harness starts with malformed primary JSON and a valid previous-state backup. `Store.load()` restores the backup, exposes a warning and rewrites the primary key. The test then parses the primary key and verifies the recovered file metadata, demonstrating durable repair rather than only an in-memory fallback.

### Accessible chart data

The HTOM detail view exposed one trend, one status and one latest-value canvas. Each had an accessible name and an adjacent disclosure containing a captioned table representing the chart labels, series and values. A real screen-reader task test is still required before making a conformance claim.

## 6. Outstanding validation

The following evidence still requires people, environments or approvals not available in this automated cycle:

- Domain-owner confirmation of every real metric’s unit, target and higher/lower rule.
- VoiceOver/NVDA task testing by an appropriate tester.
- Genuine Safari and Windows Edge execution on target devices. Firefox 153 and WebKit 26.5 compatibility checks are now recorded separately.
- Stakeholder-approved performance thresholds and the expected maximum production dataset. A five-run 1,000-row Chromium baseline is now recorded separately.
- Organisational privacy/security review and deployment approval.

## 7. Regression procedure

1. Run `npm test` and require zero failures.
2. Launch the app using the platform launcher or an HTTP static server.
3. Import both fixtures into a disposable category.
4. Confirm invalid data is rejected and valid data is displayed correctly.
5. Check overview, detail, filters, CSV and PDF export.
6. Expand each chart-data disclosure and compare its table with the visual chart.
7. Complete the keyboard/mobile navigation checks.
8. Restore or clear disposable test data.
9. Record browser, operating system, date, expected result, actual result and evidence reference.

## 8. CI

The repository includes a GitHub Actions workflow at [../../.github/workflows/test.yml](../../.github/workflows/test.yml). It runs the Node.js regression suite for pushes and pull requests. A passing local result does not substitute for checking the remote workflow result after pushing changes.

## 9. Expanded QA completed on 18 August 2026

The expanded evidence is recorded in [docs/portfolio/EXPANDED-QA-REPORT.md](docs/portfolio/EXPANDED-QA-REPORT.md). The same 48-row import, chart, filter, CSV/PDF export, mobile-keyboard and skip-link workflow passed in Chromium 151, Firefox 153 and WebKit 26.5 with no captured page error, console error or cross-origin request. WebKit is an engine proxy and is not described as genuine Safari evidence.

Twelve axe-core scans covered empty overview, upload, populated detail and settings across the three engines. The first scan found six supporting-text contrast failures and a later scan detected a transient toast contrast issue. Both were corrected. Final scans reported zero automatically detected violations, with manual contrast and screen-reader checks still required before any WCAG conformance claim.

Five Chromium runs with 1,000 generated valid rows produced medians of 56.4 ms for import, 175.4 ms for category-detail rendering and 48.4 ms for status filtering on the recorded macOS development machine. These values are a local baseline, not a production service level.
