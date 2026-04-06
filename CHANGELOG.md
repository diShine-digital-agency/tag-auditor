# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-06

### Added

- Test suite with 67 tests covering parser, auditor, and reporter modules (`npm test`).
- `CHANGELOG.md` to track version history.
- `CONTRIBUTING.md` with contribution guidelines.
- `.editorconfig` for consistent editor formatting.

### Changed

- Updated README for clarity and consistency.
- Improved `.gitignore` with additional common patterns.
- Improved `GUIDE.md` formatting and language.

### Fixed

- Dead code branch in `parser.js` where `raw.container && raw.containerVersion` duplicated the previous condition.

## [1.0.0] - 2026-04-04

### Added

- Initial release.
- GTM container JSON parser with support for multiple export formats.
- 14 audit checks: unused tags/triggers/variables, duplicates, paused tags, consent configuration, consent management, custom HTML security, performance, deprecated types, folder organization, schedule issues, blocking triggers, tag sequencing.
- Basic and custom naming convention checks.
- Four output formats: table (terminal), JSON, Markdown, CSV.
- CLI with severity filtering, quiet mode, and file output.
- Programmatic API (`parseContainer`, `auditContainer`, `formatMarkdown`, etc.).
- Zero external dependencies.

[1.1.0]: https://github.com/diShine-digital-agency/tag-auditor/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/diShine-digital-agency/tag-auditor/releases/tag/v1.0.0
