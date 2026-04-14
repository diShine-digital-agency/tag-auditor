# Contributing to tag-auditor

Thanks for your interest in contributing. Here's how to get started.

## Development setup

```bash
git clone https://github.com/diShine-digital-agency/tag-auditor.git
cd tag-auditor
```

No `npm install` needed — the project has zero dependencies.

## Running tests

```bash
npm test
```

Tests are in `test/test.js` and run with Node.js directly (no test framework).

## Project structure

```
bin/cli.js          CLI entry point
src/index.js        Public API exports
src/parser.js       GTM container JSON parser
src/auditor.js      17 audit checks + scoring
src/reporter.js     Output formatters (table, JSON, Markdown, CSV)
test/test.js        Test suite
test/sample-container.json  Sample GTM container for testing
```

## Adding a new audit check

1. Add a function in `src/auditor.js` following the existing pattern.
2. Call it from `auditContainer()`.
3. Each issue must have: `severity`, `category`, `title`, `detail`, `item`, `itemType`, `fix`.
4. Add tests in `test/test.js`.
5. Update `README.md` and `GUIDE.md` if the check is user-facing.

## Code style

- ES modules (`import`/`export`).
- No external dependencies.
- No build step.
- Consistent formatting: 2-space indent, semicolons, double quotes for strings.

## Submitting changes

1. Fork the repository.
2. Create a branch: `git checkout -b my-feature`.
3. Make your changes and add tests.
4. Run `npm test` and make sure all tests pass.
5. Open a pull request with a clear description of what changed and why.

## Reporting issues

Open an issue on GitHub with:

- What you expected to happen.
- What actually happened.
- The GTM container export (or a minimal reproduction) if relevant.
- Your Node.js version (`node --version`).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
