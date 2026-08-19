# QBR Dashboard v1.1.0

QBR Dashboard v1.1.0 is a bounded client-side prototype for importing, validating, reviewing and exporting Quarterly Business Review data.

## Verified capabilities

- CSV import with atomic validation and row-level correction messages.
- Direction-aware RAG evaluation with safe zero-target handling.
- Metric-separated charts, date/category/status filtering and searchable records.
- Transactional browser persistence with previous-state recovery.
- Consolidated CSV and PDF exports.
- Responsive navigation, keyboard focus management and chart-data alternatives.
- A 20-test Node.js regression suite executed locally and through GitHub Actions.

## Release evidence

- Local regression result: 20 passed, 0 failed and 0 skipped.
- GitHub Actions workflow: `QBR Dashboard Tests`.
- Release tag: `v1.1.0`.
- Detailed changes: see `CHANGELOG.md`.

## Limitations

This release is not described as production-ready. Representative-user testing, stakeholder acceptance, genuine Safari execution, screen-reader task testing, domain-owner metric approval and organisational security approval remain unavailable. WebKit testing is a compatibility proxy, and automated accessibility scans do not establish WCAG conformance.
