# Migration Patterns

Common transformation patterns for npm package migrations. Use these as
templates when generating fixes.

## Table of Contents

1. [API Rename](#api-rename)
2. [Import Path Change](#import-path-change)
3. [Signature Change](#signature-change)
4. [Config Schema Change](#config-schema-change)
5. [Default Value Change](#default-value-change)
6. [Removed API with Replacement](#removed-api-with-replacement)
7. [Removed API without Replacement](#removed-api-without-replacement)
8. [Callback to Promise](#callback-to-promise)
9. [Class to Function](#class-to-function)
10. [Plugin/Middleware Interface Change](#pluginmiddleware-interface-change)
11. [ESM Migration](#esm-migration)
12. [Type Changes](#type-changes)
13. [Dependency Swap](#dependency-swap)
14. [Deprecation Cleanup](#deprecation-cleanup)

---

## API Rename

**When**: A function, method, class, or constant was renamed but behavior unchanged.

```
Before: import { oldName } from 'package'
After:  import { newName } from 'package'
```

**Strategy**: Search and replace across all files. Use AST-aware replacement when
possible to avoid replacing occurrences in strings or comments.

```bash
# Simple but effective for most cases
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  -exec sed -i 's/\boldName\b/newName/g' {} +
```

**Caution**: Verify the rename doesn't collide with existing names in the project.

## Import Path Change

**When**: The package restructured its exports or module layout.

```
Before: import { util } from 'package/lib/util'
After:  import { util } from 'package/utils'
```

Common patterns:
- `package/lib/*` → `package/*` (removed lib directory)
- `package/dist/*` → `package/*` (removed dist directory)
- Deep imports consolidated into main entry
- Single entry split into subpath exports

**Strategy**: Map old paths to new paths and replace all imports.

## Signature Change

**When**: Function parameters were added, removed, reordered, or changed type.

### New required parameter added

```javascript
// Before
const result = fetchData(url)

// After — new required 'options' parameter
const result = fetchData(url, { timeout: 5000 })
```

**Strategy**: Determine a sensible default for the new parameter that preserves
old behavior. Check the migration guide for recommended defaults.

### Parameter removed

```javascript
// Before
createServer(port, hostname, callback)

// After — hostname removed, use options object
createServer(port, { onReady: callback })
```

### Parameter reordered

```javascript
// Before
transform(input, options, callback)

// After
transform(options, input)  // Returns promise instead of callback
```

**Strategy**: This usually accompanies a paradigm shift (callback → promise).
Handle both changes together.

### Options object restructured

```javascript
// Before
createClient({
  baseUrl: 'https://api.example.com',
  retries: 3,
  auth: { token: 'abc' }
})

// After — flattened config
createClient({
  url: 'https://api.example.com',    // renamed
  maxRetries: 3,                      // renamed
  token: 'abc'                        // moved from nested to top-level
})
```

**Strategy**: Build a mapping of old keys → new keys. Handle nested → flat and
flat → nested transformations.

## Config Schema Change

**When**: A configuration file or object changed its structure.

```javascript
// Before (webpack 4 → 5 example pattern)
module.exports = {
  optimization: {
    moduleIds: false,           // removed
    chunkIds: false             // removed
  }
}

// After
module.exports = {
  optimization: {
    moduleIds: 'deterministic', // new default, explicit is better
    chunkIds: 'deterministic'
  }
}
```

**Strategy**: Compare config schemas between versions. For each changed key:
1. If renamed → rename in user's config
2. If removed with no replacement → delete and comment why
3. If restructured → transform the shape
4. If default changed → add explicit old value if behavior preservation needed

## Default Value Change

**When**: A function's default behavior changed even though the API is the same.

This is the most dangerous type of breaking change because code may still compile
and run but produce different results.

```javascript
// Before: fetch with credentials included by default
fetch(url) // credentials: 'include'

// After: fetch with credentials omitted by default
fetch(url) // credentials: 'same-origin'

// Fix: explicitly set the old default
fetch(url, { credentials: 'include' })
```

**Strategy**: Identify all call sites that relied on the old default. Add
explicit arguments to preserve behavior. Flag each for `REVIEW` since the user
may actually want the new default.

## Removed API with Replacement

**When**: An API was removed but an official replacement exists.

```javascript
// Before
import { render } from 'react-dom'
render(<App />, document.getElementById('root'))

// After
import { createRoot } from 'react-dom/client'
const root = createRoot(document.getElementById('root'))
root.render(<App />)
```

**Strategy**: Generate the replacement code. If the replacement has a different
pattern (e.g., two-step instead of one-step), restructure the surrounding code.

## Removed API without Replacement

**When**: An API was removed entirely with no direct substitute.

**Strategy**:
1. Understand WHY it was removed (security, performance, philosophy change)
2. Determine what the user was trying to accomplish with the old API
3. Suggest an alternative approach using the new version's capabilities
4. If no alternative exists, suggest a third-party package or polyfill
5. Flag as `REVIEW` — this always needs human judgment

## Callback to Promise

**When**: A callback-based API was replaced with promises/async-await.

```javascript
// Before
readFile('data.json', (err, data) => {
  if (err) {
    handleError(err)
    return
  }
  processData(data)
})

// After
try {
  const data = await readFile('data.json')
  processData(data)
} catch (err) {
  handleError(err)
}
```

**Considerations**:
- The calling function must become async (may cascade up the call chain)
- Error handling moves from callbacks to try/catch
- Multiple parallel callbacks become Promise.all
- Sequential callbacks become await chains
- This can be a significant refactor — flag large cascading changes for `REVIEW`

## Class to Function

**When**: A class-based API was replaced with functions (common in modern JS).

```javascript
// Before
const client = new HttpClient({ baseUrl: '...' })
client.get('/users')

// After
const client = createHttpClient({ baseUrl: '...' })
client.get('/users')
```

**Strategy**: Replace `new ClassName(...)` with `factoryFunction(...)`. Check if
methods and properties are the same on the returned object.

## Plugin/Middleware Interface Change

**When**: The way plugins or middleware are registered changed.

```javascript
// Before (express-style example)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// After — built into the framework
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
```

**Strategy**: Map old plugin registration to new pattern. Check if:
- The plugin is now built-in
- The registration function name changed
- The plugin config options changed
- The plugin order/precedence rules changed

## ESM Migration

**When**: Package dropped CommonJS support or changed its module format.

```javascript
// Before (CJS)
const pkg = require('package')
const { util } = require('package')

// After (ESM only)
import pkg from 'package'
import { util } from 'package'
```

**Considerations**:
- The consuming project may need to switch to ESM or add `"type": "module"`
- Dynamic requires become dynamic imports: `require(x)` → `await import(x)`
- `__dirname` and `__filename` become `import.meta.dirname` / `import.meta.filename`
  (or use `fileURLToPath(import.meta.url)` for older Node)
- `module.exports` becomes `export default` / named exports
- This is often a large-scale change — flag for `REVIEW` if the project is CJS

## Type Changes

**When**: TypeScript types changed between versions.

### Narrowed types (more strict)

```typescript
// Before: accepted string | number
function process(input: string | number): void

// After: only accepts string
function process(input: string): void
```

**Strategy**: Find call sites passing the now-invalid type and add explicit conversion.

### Changed generic parameters

```typescript
// Before
interface Config<T> { data: T }

// After — new required generic
interface Config<T, U extends Validator> { data: T, validator: U }
```

**Strategy**: Add the new generic parameter at all usage sites.

### Removed type exports

```typescript
// Before
import type { InternalConfig } from 'package'

// After — type no longer exported
// Create local equivalent or use the new public type
```

**Strategy**: Check if a replacement type exists. If not, the user may need to
define the type locally based on the package's new interface.

## Dependency Swap

**When**: Replacing one package entirely with a different one (e.g., moment → dayjs,
lodash → es-toolkit, enzyme → @testing-library/react, request → got).

This is the most complex pattern because it involves changing both the package
identity AND potentially the API.

### Step 1: Replace imports

```javascript
// Before
import moment from 'moment'
import 'moment/locale/es'

// After
import dayjs from 'dayjs'
import 'dayjs/locale/es'
```

For packages with many subpath imports, build a full import path mapping:

```
moment              → dayjs
moment/locale/*     → dayjs/locale/*
moment-timezone     → dayjs/plugin/timezone (different pattern!)
```

### Step 2: Replace API calls using equivalence map

```javascript
// Before (moment)
const formatted = moment(date).format('YYYY-MM-DD')
const diff = moment(a).diff(moment(b), 'days')
const duration = moment.duration(5, 'minutes')

// After (dayjs)
const formatted = dayjs(date).format('YYYY-MM-DD')  // same API
const diff = dayjs(a).diff(dayjs(b), 'day')          // 'days' → 'day'
import duration from 'dayjs/plugin/duration'          // needs plugin
dayjs.extend(duration)
const dur = dayjs.duration(5, 'minutes')
```

### Step 3: Handle feature gaps

For APIs with `NO_EQUIVALENT`:

1. **Implement locally** — Write a utility function that provides the missing behavior
2. **Use a tiny helper package** — Sometimes a small package fills the gap
3. **Accept the behavior change** — If the missing feature isn't critical
4. **Keep the old package for just that feature** — Last resort, creates dual dependency

### Step 4: Update config and types

```javascript
// Before
import { Moment } from 'moment'
interface DateRange { start: Moment; end: Moment }

// After
import { Dayjs } from 'dayjs'
interface DateRange { start: Dayjs; end: Dayjs }
```

Also update:
- TypeScript type imports and interfaces using the old package's types
- Jest mocks of the old package (`jest.mock('moment')` → `jest.mock('dayjs')`)
- Environment configs that reference the old package
- Documentation / comments mentioning the old package

### Step 5: Clean up

```bash
# Remove old package
npm uninstall <old-package>

# Remove old type definitions if separate
npm uninstall @types/<old-package>

# Verify old package is fully gone
grep -rn "<old-package>" --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" --include="*.json" \
  --exclude-dir=node_modules .
```

## Deprecation Cleanup

**When**: Proactively replacing deprecated APIs within the same major version to
prepare for the next major, or to silence deprecation warnings.

```javascript
// Before (deprecated but still works in current major)
import { render } from 'react-dom'
render(<App />, document.getElementById('root'))
// ⚠ Warning: ReactDOM.render is deprecated in React 18

// After (modern API, same major version)
import { createRoot } from 'react-dom/client'
createRoot(document.getElementById('root')).render(<App />)
```

**Strategy**:

1. Identify all deprecated APIs used in the codebase (see intelligence gathering)
2. For each deprecated API, find its replacement in the current version's docs
3. Apply the replacement — most follow the "Removed API with Replacement" pattern
4. Run tests to verify behavior is unchanged
5. Prioritize by removal timeline — APIs scheduled for the next major go first

**Key difference from breaking changes**: Deprecated APIs still work, so this is
lower-risk. The code will function either way. This makes it safe to apply
incrementally rather than all at once.
