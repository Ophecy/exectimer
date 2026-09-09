// Standalone self-check for the per-zone manual support timer logic — no test framework needed.
// Run with: node --experimental-strip-types scripts/manualTimers.test.ts
import assert from 'node:assert/strict'
import {
  formatClock,
  liveRemainingMs,
  statusFor,
  loadStore,
  startStation,
  pauseStation,
  resetStation,
  adjustStationDuration,
  resumeAllIdle,
  resetAllTimerValues,
  ZONE_KEYS,
  type CztState,
  type ZoneKey,
  type ZoneStore,
} from '../src/manualTimers.ts'

const MIN = 60_000
const KEYCARD = 15 * MIN
const COMPBOARD = 30 * MIN

// localStorage does not exist under node, so loadStore() falls through its
// try/catch to the built-in station layout — exactly the fixture these
// checks want, and it exercises the real merge path at the same time.
const base: ZoneStore = loadStore()

const ZONE: ZoneKey = 'checkmate'
const ID = 'terminal-1'

function stationOf(store: ZoneStore, zone: ZoneKey = ZONE, id: string = ID) {
  const station = store[zone].find((s) => s.id === id)
  assert.ok(station, `no station ${zone}/${id}`)
  return station
}

// ---------- layout ----------

assert.deepEqual(ZONE_KEYS, ['checkmate', 'orbituary', 'ruinstation'])
assert.equal(base.checkmate.length, 6)
assert.equal(base.orbituary.length, 4)
assert.equal(base.ruinstation.length, 5)

// Presets follow the category: keycard doors 15 min, compboards 30 min.
for (const zone of ZONE_KEYS) {
  for (const s of base[zone]) {
    const expected = s.category === 'keycard' ? KEYCARD : COMPBOARD
    assert.equal(s.defaultDurationMs, expected, `${zone}/${s.id} preset`)
    assert.equal(s.state.running, false, `${zone}/${s.id} starts stopped`)
    assert.equal(s.state.remainingMs, expected, `${zone}/${s.id} starts full`)
  }
}

// ---------- formatting ----------

assert.equal(formatClock(90_000), '01:30')
assert.equal(formatClock(0), '00:00')
assert.equal(formatClock(-5_000), '00:00') // clamps rather than showing a negative clock

// ---------- live countdown ----------

{
  const running: CztState = { durationMs: MIN, remainingMs: MIN, running: true, updatedAt: 0 }
  assert.equal(liveRemainingMs(running, 30_000), 30_000)
  assert.equal(liveRemainingMs(running, 90_000), 0, 'clamps at zero')
  assert.equal(statusFor(running, 30_000), 'running')
  assert.equal(statusFor(running, 90_000), 'expired')

  const paused: CztState = { durationMs: MIN, remainingMs: 45_000, running: false, updatedAt: 0 }
  assert.equal(liveRemainingMs(paused, 10 * MIN), 45_000, 'a stopped timer does not drain')
  assert.equal(statusFor(paused, 10 * MIN), 'idle')
}

// ---------- start / pause / resume ----------

{
  let store = startStation(base, ZONE, ID, 0)
  assert.equal(stationOf(store).state.running, true)
  assert.equal(liveRemainingMs(stationOf(store).state, 5 * MIN), KEYCARD - 5 * MIN)

  // Pausing snapshots the live-computed remaining time.
  store = pauseStation(store, ZONE, ID, 5 * MIN)
  assert.equal(stationOf(store).state.running, false)
  assert.equal(stationOf(store).state.remainingMs, KEYCARD - 5 * MIN)

  // Resuming continues from that snapshot rather than restarting.
  store = startStation(store, ZONE, ID, 6 * MIN)
  assert.equal(liveRemainingMs(stationOf(store).state, 7 * MIN), KEYCARD - 6 * MIN)

  // Siblings and other zones are untouched.
  assert.equal(stationOf(store, ZONE, 'terminal-2').state.running, false)
  assert.equal(stationOf(store, 'orbituary', 'terminal-1').state.running, false)
}

// An expired station restarts from its preset, not from zero.
{
  let store = startStation(base, ZONE, ID, 0)
  store = pauseStation(store, ZONE, ID, KEYCARD + MIN)
  assert.equal(stationOf(store).state.remainingMs, 0)
  assert.equal(statusFor(stationOf(store).state, KEYCARD + MIN), 'expired')

  store = startStation(store, ZONE, ID, KEYCARD + 2 * MIN)
  assert.equal(stationOf(store).state.remainingMs, KEYCARD)
}

// ---------- reset ----------

{
  let store = startStation(base, ZONE, ID, 0)
  store = resetStation(store, ZONE, ID, 3 * MIN)
  const state = stationOf(store).state
  assert.equal(state.running, false)
  assert.equal(state.remainingMs, KEYCARD)
  assert.equal(state.durationMs, KEYCARD)
}

// ---------- the +/- stepper ----------

{
  let store = adjustStationDuration(base, ZONE, ID, -MIN, 0)
  assert.equal(stationOf(store).state.remainingMs, KEYCARD - MIN)

  store = adjustStationDuration(store, ZONE, ID, 5 * MIN, 0)
  assert.equal(stationOf(store).state.remainingMs, KEYCARD, 'never climbs above the preset')

  let low = base
  for (let i = 0; i < 20; i++) low = adjustStationDuration(low, ZONE, ID, -MIN, 0)
  assert.equal(stationOf(low).state.remainingMs, 0, 'never drops below zero')

  const running = startStation(base, ZONE, ID, 0)
  assert.deepEqual(
    adjustStationDuration(running, ZONE, ID, -MIN, MIN),
    running,
    'adjusting a running timer is a no-op',
  )
}

// ---------- bulk controls ----------

// resumeAllIdle starts every stopped station and leaves running ones alone.
{
  const started = startStation(base, ZONE, ID, 0)
  const resumed = resumeAllIdle(started, 5 * MIN)

  assert.equal(stationOf(resumed).state.updatedAt, 0, 'an already-running station keeps its anchor')
  for (const zone of ZONE_KEYS) {
    for (const s of resumed[zone]) assert.equal(s.state.running, true, `${zone}/${s.id} resumed`)
  }
}

// resetAllTimerValues clears every timer but preserves the station layout.
{
  let store = startStation(base, ZONE, ID, 0)
  store = adjustStationDuration(store, 'orbituary', 'tablet-4', -MIN, 0)

  const reset = resetAllTimerValues(store, 9 * MIN)
  assert.equal(reset.checkmate.length, 6, 'stations kept')
  for (const zone of ZONE_KEYS) {
    for (const s of reset[zone]) {
      assert.equal(s.state.running, false, `${zone}/${s.id} stopped`)
      assert.equal(s.state.remainingMs, s.defaultDurationMs, `${zone}/${s.id} back to preset`)
    }
  }
}

// ---------- immutability ----------

// Every transition above returned a new store; none of them may have written
// through to the fixture, or the UI's "read the store at click time" pattern
// would act on corrupted state.
assert.equal(base.checkmate[0].state.running, false)
assert.equal(base.checkmate[0].state.remainingMs, KEYCARD)
assert.equal(base.orbituary[2].state.remainingMs, COMPBOARD)

console.log('manualTimers.test.ts: all checks passed')
