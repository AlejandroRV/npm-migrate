# Peer Dependency Resolution

How to handle peer dependency conflicts during npm package migrations.

## Detection

After identifying the target package upgrade, check for peer dependency issues:

```bash
# Check what the new version expects as peers
npm view <package>@<target> peerDependencies --json

# Check what's currently installed
npm ls --depth=0 --json 2>/dev/null | jq '.dependencies'

# Try installing and capture peer warnings
npm install <package>@<target> --dry-run 2>&1 | grep -i "peer"
```

## Common Scenarios

### The upgraded package needs a newer peer

```
Example: upgrading @testing-library/react@14 → @15 requires react@18+

Resolution:
1. Check if the user's project can also upgrade react
2. If yes → upgrade both together
3. If no → document the incompatibility and suggest alternatives
```

### Another package has a peer dep on the old version

```
Example: react-router-dom has peerDependency on react@^17
         but we're upgrading react to 18

Resolution:
1. Check if react-router-dom has a version compatible with react@18
2. If yes → add it to the upgrade plan
3. If no → this is a blocker, document it
```

### Cascading peer dependencies

Some upgrades create a chain reaction. Document the full chain:

```
upgrade A@2 → requires B@3 → requires C@4 → requires Node 18+
```

Present this to the user before starting so they can decide if the full
cascade is acceptable.

## Resolution Strategy

1. Build the complete dependency graph of required changes
2. Check for circular or conflicting requirements
3. Present the full upgrade plan to the user
4. Upgrade in leaf-to-root order (most depended-on packages first)
5. Test at each step

## Using npm overrides / yarn resolutions

If a transitive dependency has a too-strict peer dep but actually works:

```json
// package.json — npm
{
  "overrides": {
    "some-package": {
      "react": "$react"
    }
  }
}

// package.json — yarn
{
  "resolutions": {
    "some-package/react": "^18.0.0"
  }
}

// package.json — pnpm
{
  "pnpm": {
    "overrides": {
      "react": "^18.0.0"
    }
  }
}
```

**Caution**: Overrides should be a last resort. They can mask real
incompatibilities. Always note overrides in the migration report as items
that need monitoring.
