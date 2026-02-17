# Intelligence Gathering

How to collect comprehensive migration data for any npm package migration:
version upgrades, dependency swaps, deprecation cleanup, and security fixes.

## Table of Contents

1. [Official Migration Guide](#official-migration-guide)
2. [Changelog Analysis](#changelog-analysis)
3. [Git-Based Diff Analysis](#git-based-diff-analysis)
4. [npm Registry Metadata](#npm-registry-metadata)
5. [Type Definition Diffing](#type-definition-diffing)
6. [Dependency Swap Research](#dependency-swap-research)
7. [Security Advisory Analysis](#security-advisory-analysis)
8. [Deprecation Scanning](#deprecation-scanning)
9. [Community Intelligence](#community-intelligence)

---

## Official Migration Guide

Check these locations in order:

```bash
# Common migration guide locations in a GitHub repo
MIGRATION.md
UPGRADING.md
docs/migration.md
docs/upgrading.md
docs/migration-guide.md
BREAKING_CHANGES.md
```

Also check:

- The package's official documentation site (usually linked in package.json `homepage`)
- GitHub release notes for the target major version tag
- Blog posts announced alongside the release

**How to fetch**: Use web search for `<package> migration guide v<target>` or
`<package> upgrade guide v<source> to v<target>`. Also fetch the repo's raw
CHANGELOG.md or MIGRATION.md directly from GitHub.

## Changelog Analysis

Parse the CHANGELOG.md or GitHub Releases between the two version tags.

### What to extract

Focus on entries between version `<source>` and `<target>` (inclusive of target,
exclusive of source). Look for:

- **BREAKING CHANGE** or **BREAKING** labels
- Entries under `### Breaking Changes` or `### ⚠ BREAKING CHANGES` headers
- Any mention of: removed, deleted, renamed, replaced, changed signature,
  changed default, no longer, now requires, must, mandatory
- Deprecation notices that became removals

### Parsing strategy

```
For each changelog entry between source and target:
  1. Classify as: breaking | deprecated | new-feature | bugfix | internal
  2. For breaking/deprecated entries, extract:
     - What was the old API/behavior
     - What is the new API/behavior
     - Is there a direct replacement or workaround
  3. Store structured data for cross-referencing
```

### Conventional Commits

Many packages use conventional commits. If the repo does:

```bash
# Breaking changes follow this pattern in commit messages:
# feat!: description
# fix!: description
# BREAKING CHANGE: description in commit body
```

## Git-Based Diff Analysis

When changelog is incomplete or absent, compare the actual source code.

### Compare exported API surface

```bash
# Compare the package's main entry point between tags
# Look at: index.js, index.d.ts, or the "main"/"exports" field in package.json

# Key files to diff:
# 1. Type definitions (*.d.ts) — most reliable for API surface
# 2. Package.json "exports" field — module entry points may have changed
# 3. Main index file — re-exports reveal removed/renamed modules
```

### What to look for in diffs

- Removed exports (function, class, type, constant)
- Renamed exports
- Changed function signatures (new required params, removed params, reordered)
- Changed default values
- Changed return types
- Changed config schemas
- Changed file/module structure (import paths)
- Removed or renamed CLI commands/flags

## npm Registry Metadata

```bash
# View all versions and metadata
npm view <package> versions --json

# Check for deprecation messages on intermediate versions
npm view <package>@<version> deprecated

# Check peer dependencies changed
npm view <package>@<source-version> peerDependencies
npm view <package>@<target-version> peerDependencies

# Check engines field changed (Node.js version requirements)
npm view <package>@<target-version> engines
```

**Important**: Check if the minimum Node.js version changed. This is a common
breaking change that isn't always in the changelog.

## Type Definition Diffing

For TypeScript packages or packages with bundled types:

```bash
# Compare type definitions between versions
# Install both versions temporarily and diff their .d.ts files

mkdir /tmp/type-diff && cd /tmp/type-diff
npm pack <package>@<source> && tar xzf *.tgz && mv package old
rm *.tgz
npm pack <package>@<target> && tar xzf *.tgz && mv package new

# Diff all type definition files
diff -rq old/ new/ --include="*.d.ts"

# For detailed diffs on changed files
diff -u old/dist/index.d.ts new/dist/index.d.ts
```

This catches changes that aren't always documented:
- Narrowed or widened types
- New required generic parameters
- Changed interface shapes
- Removed type exports

## Dependency Swap Research

When replacing one package with another (e.g., moment → dayjs, request → got,
enzyme → testing-library), gather a different kind of intelligence.

### Check for official "from X" guides

Many replacement packages provide migration guides from common predecessors:

```
# Search patterns
<new-package> migration from <old-package>
<new-package> "coming from" <old-package>
<new-package> vs <old-package>
<new-package> for <old-package> users
```

Examples of packages that provide these:
- dayjs has "Migration from Moment.js" in their docs
- got has "Migration from request" guide
- @testing-library/react has "Migration from Enzyme"
- es-toolkit has "Compatibility with lodash"
- Vite has "Migration from Webpack" section

### Build an API equivalence map

Create a mapping table between the two packages:

```
Old package API          → New package equivalent     → Notes
─────────────────────────────────────────────────────────────────
moment().format('YYYY')  → dayjs().format('YYYY')     → Same API
moment.duration()        → dayjs.duration()            → Requires plugin
moment().calendar()      → dayjs().calendar()          → Requires plugin
moment.locale()          → dayjs.locale()              → Different import pattern
moment().isValid()       → dayjs().isValid()           → Same API
moment().diff()          → dayjs().diff()              → Same API
moment.tz()              → NO DIRECT EQUIVALENT        → Use dayjs/plugin/timezone
```

### Feature gap analysis

Identify features used in the old package that:

1. **Have direct equivalents** — Map 1:1, straightforward swap
2. **Need plugins or extensions** — Equivalent exists but needs extra setup
3. **Require a different approach** — Possible but with a different pattern
4. **Have no equivalent** — Must be implemented custom or kept as a polyfill

### Check bundle size and performance differences

```bash
# Compare package sizes (useful context for the user)
npm view <old-package> dist.unpackedSize
npm view <new-package> dist.unpackedSize

# Check if new package has tree-shaking support
npm view <new-package> module  # ESM entry point
npm view <new-package> exports # Subpath exports
```

## Security Advisory Analysis

When the migration is driven by a security vulnerability:

### Fetch advisory details

```bash
# Get detailed audit information
npm audit --json 2>/dev/null | jq '.vulnerabilities["<package>"]'

# Check specific advisory
npm audit --json 2>/dev/null | jq '.vulnerabilities["<package>"].via[]'
```

### Determine actual exposure

Not every vulnerability affects every user. Check:

1. **Which API or code path is vulnerable** — Read the CVE or GitHub advisory
   to understand the attack vector.
2. **Does the user's code touch that path** — Cross-reference with the codebase
   analysis. If the user never calls the vulnerable function, the risk is lower
   (but still worth fixing).
3. **Is the fix a patch or a major** — Sometimes the fix is backported to the
   current major. Check: `npm view <package> versions --json` to see if there's
   a patched version in the user's current major range.
4. **Transitive vs direct** — If the vulnerability is in a transitive dependency,
   check if the direct dependency has released an update that bumps it.

### Prioritize by severity

| Severity | Action |
|----------|--------|
| Critical | Upgrade immediately, even if it means breaking changes |
| High | Upgrade soon, plan for code changes |
| Moderate | Include in next planned upgrade cycle |
| Low | Track, fix opportunistically |

## Deprecation Scanning

For proactive deprecation cleanup within the same major version:

### Runtime deprecation warnings

```bash
# Run the project and capture deprecation warnings
NODE_OPTIONS="--throw-deprecation" npm test 2>&1 | grep -i "deprecat"

# Or capture without throwing
NODE_OPTIONS="--trace-deprecation" npm test 2>&1 | grep -i "deprecat"
```

### Static deprecation detection

```bash
# Check for @deprecated JSDoc tags in the package's type definitions
grep -rn "@deprecated" node_modules/<package>/dist/*.d.ts 2>/dev/null

# Check for TypeScript deprecated markers
grep -rn "* @deprecated" node_modules/<package>/ \
  --include="*.d.ts" --include="*.d.mts" 2>/dev/null
```

### Changelog deprecation notices

Search the changelog for deprecation entries between the user's current version
and the latest within the same major:

```bash
# Keywords to look for
# deprecated, deprecate, will be removed, scheduled for removal,
# use X instead, replaced by, superseded by
```

For each deprecated API found, extract:
- What is deprecated
- What replaces it
- When it will be removed (which future major version)

## Community Intelligence

When official sources are insufficient, search for:

```
<package> v<target> breaking changes
<package> upgrade v<source> to v<target> issues
<package> migration problems
```

Look at:
- GitHub Issues tagged with the new version
- Stack Overflow questions about the upgrade
- Blog posts from early adopters

**Caution**: Community sources may contain incorrect or outdated information.
Always verify against the actual code/types.
