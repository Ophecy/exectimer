import { BUILD_EPOCH_MS, DEFAULT_CYCLE_CONFIG, type CycleConfig } from './cycle.ts'
import { loadJSON, saveJSON, clearKey } from './storage.ts'

export interface CycleDurationOverrides {
  powerUpMinutesPerLed?: number
  powerDownMinutesPerLed?: number
  cooldownMinutes?: number
}

const DURATIONS_KEY = 'cycle-durations'
const SYNC_ANCHOR_KEY = 'sync-anchor-ms'
const LAST_SYNC_KEY = 'last-sync-ms'

export function loadDurationOverrides(): CycleDurationOverrides {
  return loadJSON<CycleDurationOverrides>(DURATIONS_KEY, {})
}

export function saveDurationOverrides(overrides: CycleDurationOverrides): void {
  saveJSON(DURATIONS_KEY, overrides)
}

export function clearDurationOverrides(): void {
  clearKey(DURATIONS_KEY)
}

export function loadLastSyncMs(): number | null {
  return loadJSON<number | null>(LAST_SYNC_KEY, null)
}

/**
 * A local sync only outranks the published epoch when it was performed *after*
 * that epoch shipped — otherwise a visitor who calibrated once would stay stuck
 * on their stale anchor and never pick up a freshly published observation.
 * The comparison is on when the sync was made, not on the instant it points at,
 * so anchoring on a moment observed in the past stays valid.
 */
export function loadSyncAnchorMs(): number | null {
  const anchor = loadJSON<number | null>(SYNC_ANCHOR_KEY, null)
  if (anchor === null) return null
  const lastSync = loadLastSyncMs()
  if (lastSync === null || lastSync < BUILD_EPOCH_MS) {
    clearKey(SYNC_ANCHOR_KEY)
    clearKey(LAST_SYNC_KEY)
    return null
  }
  return anchor
}

export function saveSyncAnchorMs(ms: number): void {
  saveJSON(SYNC_ANCHOR_KEY, ms)
  saveJSON(LAST_SYNC_KEY, Date.now())
}

export function mergeCycleConfig(
  base: CycleConfig,
  durations: CycleDurationOverrides,
  syncAnchorMs: number | null,
): CycleConfig {
  return {
    ...base,
    powerUpMinutesPerLed: durations.powerUpMinutesPerLed ?? base.powerUpMinutesPerLed,
    powerDownMinutesPerLed: durations.powerDownMinutesPerLed ?? base.powerDownMinutesPerLed,
    cooldownMinutes: durations.cooldownMinutes ?? base.cooldownMinutes,
    referenceAllGreenAt: syncAnchorMs !== null ? new Date(syncAnchorMs) : base.referenceAllGreenAt,
  }
}

export function getEffectiveCycleConfig(): CycleConfig {
  return mergeCycleConfig(DEFAULT_CYCLE_CONFIG, loadDurationOverrides(), loadSyncAnchorMs())
}
