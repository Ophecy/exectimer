// Standalone self-check for the cycle engine — no test framework needed.
// Run with: node --experimental-strip-types scripts/cycle.test.ts
import assert from 'node:assert/strict'
import { computeCycleState, DEFAULT_CYCLE_CONFIG } from '../src/cycle.ts'

const cfg = DEFAULT_CYCLE_CONFIG
const anchor = cfg.referenceAllGreenAt.getTime()

// At the known anchor instant, the access window has just opened: all LEDs
// green, phase-timer starts a fresh 60-minute power-down countdown.
{
  const s = computeCycleState(new Date(anchor), cfg)
  assert.equal(s.phase, 'access')
  assert.equal(s.hangarAccessible, true)
  assert.deepEqual(s.ledStates, ['red', 'green', 'green', 'green', 'green'])
  assert.equal(s.currentLedIndex, 1)
  assert.equal(s.msRemainingInPhase, 60 * 60_000)
}

// One minute before the anchor: LED 5 is still charging (power-up).
{
  const s = computeCycleState(new Date(anchor - 60_000), cfg)
  assert.equal(s.phase, 'power-up')
  assert.equal(s.currentLedIndex, 5)
  assert.equal(s.hangarAccessible, false)
  assert.equal(s.msRemainingUntilOpen, 60_000)
}

// Mid power-up, LED 4 charging: LEDs 1-3 already finished charging must read
// green, not red (the mirror image of the discharge-side regression above).
{
  const epoch = anchor - 5 * 24 * 60_000
  const t72 = epoch + 72 * 60_000 // 3 LEDs fully charged (3*24min), LED 4 now charging
  const s = computeCycleState(new Date(t72), cfg)
  assert.equal(s.phase, 'power-up')
  assert.equal(s.currentLedIndex, 4)
  assert.deepEqual(s.ledStates, ['green', 'green', 'green', 'red', 'red'])
}

// Cycle start (t=0): LED 1 begins charging.
{
  const epoch = anchor - 5 * 24 * 60_000
  const s = computeCycleState(new Date(epoch), cfg)
  assert.equal(s.phase, 'power-up')
  assert.equal(s.currentLedIndex, 1)
  assert.deepEqual(s.ledStates, ['red', 'red', 'red', 'red', 'red'])
}

// Mid access phase, LED 3 discharging: LEDs 1-2 already discharged must also
// read red, not green (regression — a LED once turned off stays red, it
// doesn't get a distinct "done" color).
{
  const epoch = anchor - 5 * 24 * 60_000
  const t144 = epoch + 144 * 60_000 // 120min power-up + 24min into access (2 LEDs already down)
  const s = computeCycleState(new Date(t144), cfg)
  assert.equal(s.phase, 'access')
  assert.equal(s.currentLedIndex, 3)
  assert.deepEqual(s.ledStates, ['red', 'red', 'red', 'green', 'green'])
}

// End of access phase / start of cooldown (t = 120+60 = 180 min).
{
  const t180 = anchor - 5 * 24 * 60_000 + 180 * 60_000
  const s = computeCycleState(new Date(t180), cfg)
  assert.equal(s.phase, 'cooldown')
  assert.equal(s.currentLedIndex, null)
  assert.equal(s.hangarAccessible, false)
  assert.deepEqual(s.ledStates, ['red', 'red', 'red', 'red', 'red'])
}

// Total cycle length is 185 minutes, and it wraps: t=185min == t=0min.
{
  const epoch = anchor - 5 * 24 * 60_000
  const a = computeCycleState(new Date(epoch), cfg)
  const b = computeCycleState(new Date(epoch + 185 * 60_000), cfg)
  assert.equal(a.phase, b.phase)
  assert.equal(a.currentLedIndex, b.currentLedIndex)
  assert.equal(a.cycleDurationMs, 185 * 60_000)
}

// Arbitrary far-past/far-future instants must resolve without throwing and
// stay within valid bounds (modulo arithmetic must handle negative deltas).
{
  const past = computeCycleState(new Date('1999-01-01T00:00:00Z'), cfg)
  const future = computeCycleState(new Date('2099-01-01T00:00:00Z'), cfg)
  for (const s of [past, future]) {
    assert.ok(s.msRemainingInCycle >= 0 && s.msRemainingInCycle <= s.cycleDurationMs)
    assert.ok(s.msRemainingInPhase >= 0)
  }
}

console.log('cycle.test.ts: all checks passed')
