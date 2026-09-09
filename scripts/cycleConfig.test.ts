// Standalone self-check for admin config overrides merging — no test framework needed.
// Run with: node --experimental-strip-types scripts/cycleConfig.test.ts
import assert from 'node:assert/strict'
import { mergeCycleConfig } from '../src/cycleConfig.ts'
import { DEFAULT_CYCLE_CONFIG } from '../src/cycle.ts'

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

console.log('cycleConfig.test.ts: all checks passed')
