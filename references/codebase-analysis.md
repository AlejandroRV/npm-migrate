# Codebase Analysis

How to scan a project and build a complete usage map of the package being migrated.

## Table of Contents

1. [Import Discovery](#import-discovery)
2. [Usage Mapping](#usage-mapping)
3. [Configuration Files](#configuration-files)
4. [Dependency Graph](#dependency-graph)
5. [Monorepo Handling](#monorepo-handling)

---

## Import Discovery

Find every file that imports or requires the target package.

```bash
# Find all imports/requires of the package (handles common patterns)
# Adjust the package name as needed

PACKAGE="<package-name>"

# ES module imports
grep -rn "from ['\"]${PACKAGE}" --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" --include="*.mjs" --include="*.mts" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build .

# CommonJS requires
grep -rn "require(['\"]${PACKAGE}" --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" --include="*.cjs" --include="*.cts" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build .

# Dynamic imports
grep -rn "import(['\"]${PACKAGE}" --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build .

# Also check for subpath imports like "axios/lib/helpers"
grep -rn "from ['\"]${PACKAGE}/" --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build .
```

### Import Pattern Classification

Classify each import into one of these patterns:

| Pattern | Example | Migration Impact |
|---------|---------|-----------------|
| Default import | `import axios from 'axios'` | Check if default export changed |
| Named imports | `import { Router } from 'express'` | Check each named export still exists |
| Namespace import | `import * as lodash from 'lodash'` | Need to check all used members |
| Type-only import | `import type { Config } from 'pkg'` | Check type definitions changed |
| Subpath import | `import helper from 'pkg/utils'` | Check if subpath exports changed |
| Re-export | `export { thing } from 'pkg'` | Downstream consumers affected |
| Side-effect import | `import 'pkg/styles.css'` | Check if side-effect files moved |

## Usage Mapping

For each imported symbol, trace how it's used in the codebase.

### What to capture per symbol

```
Symbol: <name>
Type: function | class | constant | type | interface | enum
Files used in: [list of file paths]
Usage patterns:
  - How it's called (arguments, chaining, configuration)
  - What's done with the return value
  - Whether it's passed to other functions
  - Whether it's extended or composed with other code
  - Whether its types are used in the project's own type definitions
```

### Common usage patterns to check

**Function calls**: Document the arguments being passed — changes to parameter
order, required params, or accepted types are common breaking changes.

**Configuration objects**: Many packages take config objects. Document the full
shape of config objects used in the project — removed or renamed config keys
are very common breaking changes.

**Chaining / fluent APIs**: Document the method chains used — removed chain
methods break silently (they throw at runtime, not compile time in JS).

**Event listeners / callbacks**: Document callback signatures — changed callback
arguments are a subtle breaking change.

**Class extension**: If the project extends a class from the package, any
change to the base class interface or constructor is breaking.

**Middleware / plugin patterns**: Document all middleware or plugins registered,
as the registration API or plugin interface often changes between majors.

## Configuration Files

Check for package-specific config files:

```bash
# Common config file patterns
ls -la .${PACKAGE}rc .${PACKAGE}rc.* ${PACKAGE}.config.* .${PACKAGE}.* 2>/dev/null

# Also check package.json for embedded config
cat package.json | jq ".${PACKAGE} // empty"

# Check common config locations
ls -la config/ .config/ 2>/dev/null | grep -i ${PACKAGE}
```

### Framework-specific configs

Some packages integrate with build tools. Check:

- **webpack.config.js** — Loaders and plugins from the package
- **babel.config.js / .babelrc** — Babel plugins/presets from the package
- **jest.config.js** — Transforms, test environments from the package
- **tsconfig.json** — Compiler options related to the package
- **eslint.config.js / .eslintrc** — ESLint plugins/rules from the package
- **vite.config.ts** — Vite plugins from the package
- **next.config.js** — Next.js config using the package

## Dependency Graph

Check if other installed packages depend on the one being migrated.

```bash
# Find packages that peer-depend on the target package
npm ls <package> 2>/dev/null

# Check if any other deps have peer dependency requirements
cat node_modules/*/package.json 2>/dev/null | \
  jq -r 'select(.peerDependencies["'$PACKAGE'"]) | .name' 2>/dev/null
```

**Why this matters**: Upgrading package X might break package Y if Y has a
peer dependency on X@<old-version>. These co-dependencies must be upgraded
together.

### Common co-dependency groups

Some packages always need to be upgraded together:

- `@babel/*` packages (core + presets + plugins)
- `@testing-library/*` packages
- `eslint` + `eslint-plugin-*` + `eslint-config-*`
- `webpack` + `webpack-cli` + loaders + plugins
- `react` + `react-dom` + `@types/react`
- `typescript` + `ts-node` + type definition packages
- `jest` + `ts-jest` + `@types/jest`

## Monorepo Handling

If the project is a monorepo, scan all workspace packages.

```bash
# Detect monorepo setup
if [ -f "pnpm-workspace.yaml" ]; then
  echo "pnpm workspace detected"
  cat pnpm-workspace.yaml
elif jq -e '.workspaces' package.json > /dev/null 2>&1; then
  echo "npm/yarn workspace detected"
  jq '.workspaces' package.json
elif [ -f "lerna.json" ]; then
  echo "lerna detected"
  cat lerna.json | jq '.packages'
fi

# Find which workspace packages use the target package
for pkg_json in $(find . -name package.json -not -path "*/node_modules/*" -not -path "*/dist/*"); do
  if jq -e --arg p "$PACKAGE" \
    '(.dependencies[$p] // .devDependencies[$p] // .peerDependencies[$p]) != null' \
    "$pkg_json" > /dev/null 2>&1; then
    echo "Used in: $pkg_json"
  fi
done
```

**Important for monorepos**:

- Different workspaces may use different versions — document this.
- Shared internal packages may re-export symbols from the migrated package.
- Hoisted dependencies mean the lock file is the source of truth for what's installed.
- Some workspaces might not need the upgrade yet — plan accordingly.
