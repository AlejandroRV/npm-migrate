# npm-migrate

AI-assisted migration of npm packages: major version upgrades, deprecation cleanup, new API adoption, security-driven updates, and full dependency replacement (swapping one package for another). Analyzes what changed, scans your codebase, and generates targeted fixes.

## Install

```bash
npx skills add AlejandroRV/npm-migrate
```

## What it does

When you ask your AI agent to upgrade, migrate, or swap an npm package, this skill:

1. **Gathers intelligence** — Fetches migration guides, changelogs, API diffs, security advisories, or API equivalence maps (for dependency swaps)
2. **Scans your codebase** — Builds a map of every import, API call, config, and usage pattern for the package
3. **Cross-references** — Matches changes against your actual usage to find what's affected vs. safe
4. **Generates fixes** — Produces targeted code changes, codemods for widespread mechanical changes, and flags items needing human review
5. **Verifies** — Runs your tests, type-checker, and linter to confirm the migration succeeded

### Migration types supported

- **Major version upgrades** — Breaking changes between major versions (e.g., express 4 → 5)
- **Deprecation cleanup** — Proactively replace deprecated APIs before the next major forces you to
- **Feature adoption** — Adopt new patterns from a package update (e.g., React class → hooks)
- **Security-driven upgrades** — When npm audit flags a vulnerability that requires code changes
- **Dependency replacement** — Swap one package for another entirely (e.g., moment → dayjs, lodash → es-toolkit, enzyme → testing-library)

## Works with

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Cursor](https://cursor.sh)
- [Windsurf](https://windsurf.com)
- [GitHub Copilot](https://github.com/features/copilot)
- Any agent that supports the [Agent Skills](https://skills.sh/docs) standard

## Skill structure

```
npm-migrate/
├── SKILL.md                                # Main skill instructions
├── references/
│   ├── intelligence-gathering.md           # How to fetch changelogs, diffs, docs, API maps, advisories
│   ├── codebase-analysis.md                # How to scan project usage
│   ├── migration-patterns.md               # 14 transformation patterns (incl. dependency swap)
│   ├── codemod-generation.md               # When and how to generate codemods
│   └── peer-dependencies.md                # Resolving peer dep conflicts
└── scripts/
    └── post-migration-verify.mjs           # Automated verification after migration
```

## Example usage

### Major version upgrade

```
> Upgrade express from v4 to v5

Scanning your project for express usage...
Found 23 files importing express across 3 workspace packages.

Breaking changes in express 5:
  AFFECTED: req.param() removed — you use this in 4 route handlers
  AFFECTED: app.del() renamed to app.delete() — found in routes/api.js
  SAFE:     RegExp changes in route paths — your routes don't use regex
  REVIEW:   Body parser now built-in — you currently use body-parser package
  ...

Applying fixes...
  ✅ Replaced req.param('id') → req.params.id in 4 files
  ✅ Renamed app.del → app.delete in 1 file
  ⚠️  Manual review: Remove body-parser and use express.json() instead? (routes/middleware.js)

Verification:
  Dependencies resolve  ✅
  TypeScript compilation ✅
  Test suite            ✅ (142 passed)
  Linter                ✅
```

### Dependency swap

```
> Replace moment with dayjs

Scanning your project for moment usage...
Found 31 files importing moment.

API equivalence map:
  ✅ Direct equivalent:     moment().format() → dayjs().format() (18 usages)
  ✅ Direct equivalent:     moment().diff() → dayjs().diff() (7 usages)
  📦 Needs plugin:          moment.duration() → dayjs.duration() (4 usages)
  📦 Needs plugin:          moment().calendar() → dayjs().calendar() (2 usages)
  ⚠️  No direct equivalent: moment.defineLocale() — used in i18n/custom-locale.js

Applying fixes...
  ✅ Replaced imports in 31 files
  ✅ Installed dayjs plugins: duration, calendar
  ✅ Updated type imports: Moment → Dayjs in 8 files
  ⚠️  Manual review: custom locale definition needs rewrite (i18n/custom-locale.js)

Verification:
  Dependencies resolve               ✅
  Old package "moment" fully removed  ✅
  TypeScript compilation              ✅
  Test suite                          ✅ (89 passed)
  No deprecation warnings             ✅
```

## License

MIT
