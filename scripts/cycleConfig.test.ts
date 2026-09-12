// Standalone self-check for admin config overrides merging — no test framework needed.
// Run with: node --experimental-strip-types scripts/cycleConfig.test.ts
import assert from 'node:assert/strict'
import { mergeCycleConfig, loadSyncAnchorMs, saveSyncAnchorMs } from '../src/cycleConfig.ts'
import { BUILD_EPOCH_MS, DEFAULT_CYCLE_CONFIG } from '../src/cycle.ts'

// storage.ts talks to the real Web Storage API; node has none, so back it with
// a plain Map for the precedence checks below.
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  configurable: true,
})

// No overrides: effective config equals the base config untouched.
{
  const merged = mergeCycleConfig(DEFAULT_CYCLE_CONFIG, {}, null)
  assert.deepEqual(merged, DEFAULT_CYCLE_CONFIG)
}

// Partial duration overrides only replace the fields that were set.
{
  const merged = mergeCycleConfig(DEFAULT_CYCLE_CONFIG, { powerUpMinutesPerLed: 30 }, null)
  assert.equal(merged.powerUpMinutesPerLed, 30)
  assert.equal(merged.powerDownMinutesPerLed, DEFAULT_CYCLE_CONFIG.powerDownMinutesPerLed)
  assert.equal(merged.cooldownMinutes, DEFAULT_CYCLE_CONFIG.cooldownMinutes)
}

// A sync anchor override replaces the reference instant used for calibration.
{
  const anchorMs = Date.UTC(2026, 0, 1, 12, 0, 0)
  const merged = mergeCycleConfig(DEFAULT_CYCLE_CONFIG, {}, anchorMs)
  assert.equal(merged.referenceAllGreenAt.getTime(), anchorMs)
}

// A sync performed after the published epoch shipped outranks it — including
// when it anchors on a moment observed in the past.
{
  store.clear()
  saveSyncAnchorMs(BUILD_EPOCH_MS - 3_600_000)
  assert.equal(loadSyncAnchorMs(), BUILD_EPOCH_MS - 3_600_000)
}

// A sync older than the published epoch is stale: it gets dropped so the
// visitor picks up the new project-wide anchor without resyncing by hand.
{
  store.clear()
  saveSyncAnchorMs(BUILD_EPOCH_MS + 1_000)
  store.set('pht:last-sync-ms', String(BUILD_EPOCH_MS - 1))
  assert.equal(loadSyncAnchorMs(), null)
  assert.equal(store.has('pht:sync-anchor-ms'), false)
}

// An anchor with no recorded sync time predates the epoch mechanism entirely.
{
  store.clear()
  store.set('pht:sync-anchor-ms', String(BUILD_EPOCH_MS + 1_000))
  assert.equal(loadSyncAnchorMs(), null)
}

console.log('cycleConfig.test.ts: all checks passed')
