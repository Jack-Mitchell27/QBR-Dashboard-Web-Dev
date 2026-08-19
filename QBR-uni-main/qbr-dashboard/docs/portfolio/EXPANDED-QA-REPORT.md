# QBR Dashboard: Expanded QA Report

**Test date:** 18 August 2026
**Host:** macOS on Apple silicon, Node.js 22.14.0
**Delivery:** Static application served over a disposable loopback HTTP origin
**Data:** 48-row checked fixture plus a generated 1,000-row performance fixture

## 1. Outcome summary

| Area | Result | Evidence boundary |
|---|---|---|
| Automated regression | 20 passed, 0 failed, 0 skipped | Pure logic and persistence harnesses, not the complete browser UI |
| Built-in coverage | 76.24% lines, 61.60% branches, 68.10% functions across loaded files | Aggregate includes tests and bundled PapaParse; per-module values are more informative |
| Chromium workflow | Pass | Headless Chromium 151.0.7922.34 |
| Firefox workflow | Pass | Headless Firefox 153.0 |
| WebKit workflow | Pass | Headless WebKit 26.5, not a claim of genuine Safari support |
| Automated accessibility | Zero detected violations after fixes | Twelve scans: four views in three engines; manual checks remain necessary |
| 1,000-row performance | Import median 56.4 ms; detail render median 175.4 ms | Five local Chromium runs on one development machine |
| Runtime stability | No page errors or browser-console errors | Observed during the scripted workflows only |
| Client-side privacy observation | No cross-origin request recorded | Network observation, not an organisational security assessment |

## 2. Cross-browser workflow

The same disposable workflow ran independently in Chromium, Firefox and WebKit:

1. Load a clean first-run state and confirm eight categories.
2. Open Upload Data and import the valid 48-row fixture into HTOM.
3. Open HTOM and confirm 48 data points, three named charts and three adjacent data tables.
4. Confirm that a mixed `Total Value` is absent.
5. Apply the red filter and confirm 16 records.
6. Download a 4,678-byte consolidated CSV.
7. Download a PDF of approximately 106 KB.
8. At 390 by 844 pixels, open navigation using the keyboard, move focus into it, close with Escape and restore focus to the toggle.
9. Activate the skip link and confirm that focus or the location target reaches main content.
10. Record runtime errors and cross-origin requests.

All three engines passed every assertion. No browser-console error, uncaught page error or external network request was captured. The generated files had non-empty, consistent sizes across the engines.

### Browser limitation

Playwright WebKit exercises the browser engine used by Safari, but it is not the signed Safari application and can differ in media, security, storage and operating-system integration. The report can state that Firefox and a WebKit compatibility proxy were tested. It must not state that genuine Safari testing passed until the workflow is repeated in Safari on the target device.

## 3. Accessibility evaluation

Automated scans used axe-core rules tagged for WCAG 2 A/AA, WCAG 2.1 A/AA and WCAG 2.2 AA. Each engine scanned:

- the empty overview;
- the upload screen;
- a populated HTOM detail screen;
- the settings and schema screen.

The initial scan found six serious contrast failures. Supporting text used `#8595a8` on white at a measured 3.06:1 ratio. The colour was changed to `#64748b`. A later scan caught success-toast text while an opacity entrance animation reduced its effective contrast to 3.75:1. Removing opacity from the animation kept full contrast throughout. The final twelve scans reported zero automatically detected violations.

Axe marked between 24 and 26 contrast nodes per view for manual review because backgrounds or rendered content could not be conclusively calculated. Automated results therefore do not prove WCAG conformance. The W3C explains that accessibility evaluation needs both automated checking and human evaluation (W3C, 2024). Remaining checks include:

- complete task testing with VoiceOver and, where relevant, NVDA;
- 200% and 400% zoom and reflow inspection;
- forced-colours and high-contrast modes;
- a full keyboard-only import-to-export task;
- manual contrast confirmation for canvas, status tokens and focus states;

The application already provides a skip link, visible focus treatment, labelled controls, reduced-motion support, keyboard-managed mobile navigation, named chart canvases and semantic data alternatives. Chart.js notes that canvas content is not inherently accessible, which is why the adjacent chart-data tables remain necessary (Chart.js, 2025).

## 4. Performance method and results

A generated valid CSV contained 1,000 rows, 10 metrics, 12 reporting dates and direction-aware targets. Each run started in a new Chromium browser context. Timing used wall-clock measurements around completed application actions, plus the browser navigation entry. Five repetitions reduced the influence of a single warm-up or scheduling event.

| Measure | Median | Minimum | Maximum |
|---|---:|---:|---:|
| Page load wall time | 61.1 ms | 59.8 ms | 74.1 ms |
| Browser navigation duration | 59.7 ms | 58.5 ms | 66.7 ms |
| Parse, validate and persist 1,000 rows | 56.4 ms | 54.6 ms | 57.9 ms |
| Render 1,000-row category detail | 175.4 ms | 173.4 ms | 176.6 ms |
| Apply red filter and rerender | 48.4 ms | 47.1 ms | 55.3 ms |

Every run retained 1,000 rows and reported approximately 223.1 KB of application storage. These figures indicate responsive behaviour for this fixture on this machine, not a production service-level commitment. No stakeholder-approved data volume or response-time threshold exists. Performance should be rerun on a lower-powered target device and with the largest expected real dataset before release.

## 5. Regression and coverage evidence

`npm test` ran 20 tests with zero failures. The stable Node.js test runner provides repeatable execution and a non-zero process result for failures (Node.js contributors, n.d.). Coverage was collected using Node's experimental coverage output.

| Application module | Line coverage | Branch coverage | Function coverage |
|---|---:|---:|---:|
| [../../js/parser.js](../../js/parser.js) | 92.81% | 73.02% | 92.00% |
| [../../js/store.js](../../js/store.js) | 83.77% | 73.53% | 54.84% |
| [../../js/filters.js](../../js/filters.js) | 69.35% | 90.00% | 42.86% |
| [../../js/charts.js](../../js/charts.js) | 46.38% | 71.43% | 52.17% |
| [../../js/export.js](../../js/export.js) | 27.65% | 50.00% | 69.23% |

Lower line coverage in chart and export modules is expected because browser rendering and download branches are not all reached by the Node harness. The multi-engine workflow supplies complementary integration evidence, but durable browser tests would be a useful future addition.

## 6. Security and privacy observations

CSV values beginning with common formula markers are neutralised before export. This reduces spreadsheet-formula injection risk, but OWASP states that no mitigation is universally safe for every spreadsheet and downstream consumer (OWASP Foundation, n.d.). The test is therefore described as protection, not a guarantee.

No cross-origin request occurred while loading the locally bundled application, importing data, filtering or exporting. This supports the claim that the tested workflow processed application data locally. It does not replace source review, penetration testing, dependency assessment, privacy impact assessment or organisational approval.

`localStorage` persists data by origin and can be unavailable under browser policy. File-origin behaviour is also undefined across browsers (MDN contributors, 2026). HTTP launchers, transactional writes, previous-state recovery and visible storage errors reduce this risk, but local storage still lacks central backup, access control, multi-user governance and server-side audit history.

## 7. Defects found and corrected in this QA cycle

| ID | Finding | Change | Retest |
|---|---|---|---|
| A11Y-01 | Six supporting-text nodes measured 3.06:1 against white | Changed faint text from `#8595a8` to `#64748b` | Zero detected violations across the final twelve scans |
| A11Y-02 | Toast opacity animation produced a transient 3.75:1 result | Removed opacity from the entrance animation | Zero detected violations across the final twelve scans |
| QA-01 | Pointer-based automation did not restore focus in WebKit because macOS pointer clicks do not necessarily focus buttons | Corrected the test to open the menu using keyboard focus and Enter | Keyboard focus entry, Escape close and focus return passed in all three engines |

`QA-01` was a test-method issue, not an application defect. Keeping it in the log demonstrates that failures were investigated rather than simply removed.

## 8. Release recommendation

The software is suitable for controlled internal evaluation with fictional or approved data. Technical release should remain conditional on genuine Safari testing if Safari is a target, domain-owner validation of targets and metric direction, manual assistive-technology evaluation, expected-volume testing on a target device, and organisational privacy/security approval. Representative-user validation was unavailable and is documented as an evidence limitation rather than a release activity completed by this project.
