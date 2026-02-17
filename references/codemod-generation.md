# Codemod Generation

When to generate codemods and how to structure them for npm migrations.

## When to Use Codemods

Generate a codemod when:
- The same mechanical transformation applies to 5+ files
- The change is purely syntactic (rename, restructure, reorder)
- No human judgment is needed for the transformation

Do NOT use codemods when:
- The fix depends on surrounding context
- Different occurrences need different fixes
- The change involves architectural decisions

## Codemod Structure

Generate codemods as standalone Node.js scripts that can be run with:
```bash
node migrate-<package>-<change>.mjs
```

### Template

```javascript
#!/usr/bin/env node
/**
 * Codemod: <description>
 * Package: <package> v<from> → v<to>
 * Change:  <what this codemod does>
 *
 * Usage: node <script-name>.mjs [--dry-run] [--path <dir>]
 *
 * Run with --dry-run first to preview changes.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const DRY_RUN = process.argv.includes('--dry-run')
const TARGET_PATH = getArgValue('--path') || '.'
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts']
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.next', 'coverage']

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : null
}

function walkDir(dir, callback) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry) && !entry.startsWith('.')) {
        walkDir(fullPath, callback)
      }
    } else if (EXTENSIONS.includes(extname(entry))) {
      callback(fullPath)
    }
  }
}

// ─── Transform Logic ───────────────────────────────────
// Customize this section for each codemod

function transform(content, filePath) {
  let modified = content

  // Example: Rename an import
  // modified = modified.replace(
  //   /from\s+['"]old-package['"]/g,
  //   "from 'new-package'"
  // )

  return modified
}

// ─── Runner ────────────────────────────────────────────

let filesChanged = 0
let totalChanges = 0

walkDir(TARGET_PATH, (filePath) => {
  const original = readFileSync(filePath, 'utf8')
  const transformed = transform(original, filePath)

  if (transformed !== original) {
    filesChanged++
    if (DRY_RUN) {
      console.log(`[DRY RUN] Would modify: ${filePath}`)
    } else {
      writeFileSync(filePath, transformed, 'utf8')
      console.log(`Modified: ${filePath}`)
    }
  }
})

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Done.`)
console.log(`Files ${DRY_RUN ? 'would be ' : ''}modified: ${filesChanged}`)
```

## Common Transform Patterns

### Rename imports

```javascript
// Rename a named import
modified = modified.replace(
  /\b(import\s+\{[^}]*)\boldName\b([^}]*\})/g,
  (match, before, after) => `${before}newName${after}`
)

// Also rename usage in the file
modified = modified.replace(/\boldName\b/g, 'newName')
```

### Change import paths

```javascript
// Change subpath imports
modified = modified.replace(
  /from\s+['"]package\/old\/path['"]/g,
  "from 'package/new/path'"
)
```

### Add missing arguments

```javascript
// Add a second argument to a function call
modified = modified.replace(
  /functionName\((\s*[^,)]+)\s*\)/g,
  'functionName($1, { /* new required option */ })'
)
```

### Replace method calls

```javascript
// obj.oldMethod() → obj.newMethod()
modified = modified.replace(
  /\.oldMethod\s*\(/g,
  '.newMethod('
)
```

### Dependency swap — replace package in imports

```javascript
// Replace all imports from old package to new package
modified = modified.replace(
  /from\s+['"]old-package['"]/g,
  "from 'new-package'"
)
modified = modified.replace(
  /from\s+['"]old-package\/([^'"]+)['"]/g,
  "from 'new-package/$1'"
)
modified = modified.replace(
  /require\s*\(\s*['"]old-package['"]\s*\)/g,
  "require('new-package')"
)
```

### Dependency swap — replace API calls

```javascript
// When the new package has different method names
const API_MAP = {
  'oldMethod': 'newMethod',
  'oldProp': 'newProp',
  // add all mappings
}

for (const [oldApi, newApi] of Object.entries(API_MAP)) {
  const regex = new RegExp(`\\.${oldApi}\\b`, 'g')
  modified = modified.replace(regex, `.${newApi}`)
}
```

### Dependency swap — replace type imports

```typescript
// Replace type-only imports
modified = modified.replace(
  /import\s+type\s+\{([^}]+)\}\s+from\s+['"]old-package['"]/g,
  "import type {$1} from 'new-package'"
)

// Replace specific type names if they changed
const TYPE_MAP = {
  'OldType': 'NewType',
  'OldInterface': 'NewInterface',
}

for (const [oldType, newType] of Object.entries(TYPE_MAP)) {
  const regex = new RegExp(`\\b${oldType}\\b`, 'g')
  modified = modified.replace(regex, newType)
}
```

## Codemod Verification

After generating a codemod, always:

1. Run with `--dry-run` first to show affected files
2. Apply the codemod
3. Run `npx tsc --noEmit` to check for type errors (if TypeScript)
4. Run `npm test` to check for runtime errors
5. Run `git diff` to review all changes

If the codemod introduces errors, fix them manually and document the edge cases
for the migration report.
