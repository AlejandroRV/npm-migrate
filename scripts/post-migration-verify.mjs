#!/usr/bin/env node
/**
 * post-migration-verify.mjs
 *
 * Run after applying a migration to verify the project still works.
 * Usage: node post-migration-verify.mjs [--package <name>]
 *
 * Checks: deps resolve, TS compiles, tests pass, lint, build, old pkg removed (swaps), no deprecation warnings.
 * Outputs a structured JSON report.
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'

const PACKAGE = getArgValue('--package') || 'unknown'
const SWAP_FROM = getArgValue('--swap-from')

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : null
}

function run(cmd, label) {
  const start = Date.now()
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return {
      label,
      status: 'pass',
      duration_ms: Date.now() - start,
      output: output.slice(0, 500)
    }
  } catch (err) {
    return {
      label,
      status: 'fail',
      duration_ms: Date.now() - start,
      output: (err.stderr || err.stdout || err.message || '').slice(0, 1000)
    }
  }
}

function detectChecks() {
  const checks = []
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

  // Always check npm install
  checks.push({ cmd: 'npm install --ignore-scripts', label: 'Dependencies resolve' })

  // Check for TypeScript
  if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
    checks.push({ cmd: 'npx tsc --noEmit', label: 'TypeScript compilation' })
  }

  // Check for test script
  if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
    checks.push({ cmd: 'npm test', label: 'Test suite' })
  }

  // Check for lint script
  if (pkg.scripts?.lint) {
    checks.push({ cmd: 'npm run lint', label: 'Linter' })
  }

  // Check for build script
  if (pkg.scripts?.build) {
    checks.push({ cmd: 'npm run build', label: 'Build' })
  }

  // If this was a dependency swap, verify old package is fully removed
  if (SWAP_FROM) {
    checks.push({
      cmd: `bash -c 'FOUND=$(grep -rn "${SWAP_FROM}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build . 2>/dev/null | head -20); if [ -n "$FOUND" ]; then echo "$FOUND"; exit 1; else echo "No references found"; fi'`,
      label: `Old package "${SWAP_FROM}" fully removed from source`
    })
    checks.push({
      cmd: `bash -c 'if jq -e --arg p "${SWAP_FROM}" "(.dependencies[\$p] // .devDependencies[\$p]) != null" package.json > /dev/null 2>&1; then echo "Still in package.json"; exit 1; else echo "Not in package.json"; fi'`,
      label: `Old package "${SWAP_FROM}" removed from package.json`
    })
  }

  // Check for runtime deprecation warnings
  if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
    checks.push({
      cmd: `bash -c 'WARNINGS=$(NODE_OPTIONS="--trace-deprecation" npm test 2>&1 | grep -i "deprecat" | head -10); if [ -n "$WARNINGS" ]; then echo "$WARNINGS"; exit 1; else echo "No deprecation warnings"; fi'`,
      label: 'No deprecation warnings'
    })
  }

  return checks
}

// ─── Main ──────────────────────────────────────────────

console.log(`\nVerifying migration: ${PACKAGE}`)
console.log('═'.repeat(50))

const checks = detectChecks()
const results = []

for (const check of checks) {
  process.stdout.write(`  ${check.label}... `)
  const result = run(check.cmd, check.label)
  console.log(result.status === 'pass' ? '✅' : '❌')
  results.push(result)
}

const passed = results.filter(r => r.status === 'pass').length
const failed = results.filter(r => r.status === 'fail').length

console.log('═'.repeat(50))
console.log(`Results: ${passed} passed, ${failed} failed\n`)

if (failed > 0) {
  console.log('Failed checks:')
  for (const r of results.filter(r => r.status === 'fail')) {
    console.log(`\n  ❌ ${r.label}:`)
    console.log(`  ${r.output.split('\n').slice(0, 5).join('\n  ')}`)
  }
}

// Output structured JSON for programmatic use
const report = {
  package: PACKAGE,
  timestamp: new Date().toISOString(),
  summary: { passed, failed, total: results.length },
  checks: results
}

const reportPath = `migration-verify-${PACKAGE}.json`
import('fs').then(fs => {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\nFull report: ${reportPath}`)
})
