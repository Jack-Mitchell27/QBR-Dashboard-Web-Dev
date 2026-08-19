# Changelog

## v1.1.0 - 2026-08-19

### Added

- Direction-aware RAG status evaluation for higher-is-better and lower-is-better metrics.
- Transactional browser storage with previous-state recovery.
- Accessible data-table alternatives for dashboard charts.
- Responsive navigation with keyboard focus management.
- A 20-test automated regression suite and GitHub Actions workflow.
- Cross-platform launchers for macOS, Windows and Linux.

### Improved

- Metric separation so incompatible units are not aggregated into misleading totals.
- CSV validation with atomic rejection and row-level correction messages.
- Consolidated CSV and PDF export completeness.
- Keyboard accessibility, visible focus and reduced-motion behaviour.
- Demonstration-data labelling and empty-state guidance.

### Fixed

- Incorrect status handling for lower-is-better metrics.
- Zero-target status boundary behaviour.
- The historical PDF row limitation.
- Storage failures that could otherwise leave memory and persisted state inconsistent.
- Chart and DataTable lifecycle issues during repeated rendering.
- Contrast issues identified during accessibility testing.

### Known limitations

- The application remains a bounded prototype and is not described as production-ready.
- Representative-user testing and stakeholder acceptance were unavailable.
- WebKit testing is a compatibility proxy and is not evidence of genuine Safari execution.
- Automated accessibility scans do not establish WCAG conformance; screen-reader task testing remains unavailable.
- Browser storage is device- and origin-specific, with no central backup or multi-user synchronisation.
