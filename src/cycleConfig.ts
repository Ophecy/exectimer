import { BUILD_EPOCH_MS, DEFAULT_CYCLE_CONFIG, type CycleConfig } from './cycle.ts'
import { loadJSON, saveJSON, clearKey } from './storage.ts'

export interface CycleDurationOverrides {
  powerUpMinutesPerLed?: number
  powerDownMinutesPerLed?: number
  cooldownMinutes?: number
}

const DURATIONS_KEY = 'cycle-durations'
const SYNC_ANCHOR_KEY = 'sync-anchor-ms'
const SYNC_BUILD_EPOCH_KEY = 'sync-build-epoch-ms'

export function loadDurationOverrides(): CycleDurationOverrides {
  return loadJSON<CycleDurationOverrides>(DURATIONS_KEY, {})
}

export function saveDurationOverrides(overrides: CycleDurationOverrides): void {
  saveJSON(DURATIONS_KEY, overrides)
}

export function clearDurationOverrides(): void {
  clearKey(DURATIONS_KEY)
}

/**
 * A local sync holds only while the published epoch it was made against is the
 * one still shipping: publishing a fresh observation recalibrates every visitor,
 * including those who once synced on their own machine. The test is on which
 * epoch was current, never on wall-clock order — an epoch legitimately points at
 * a future instant, which a timestamp comparison would read as "already stale".
 */
export function loadSyncAnchorMs(): number | null {
  const anchor = loadJSON<number | null>(SYNC_ANCHOR_KEY, null)
  if (anchor === null) return null
  if (loadJSON<number | null>(SYNC_BUILD_EPOCH_KEY, null) !== BUILD_EPOCH_MS) {
    clearSyncAnchor()
    return null
  }
  return anchor
}

/** Drops the local calibration so the published build epoch takes over again. */
export function clearSyncAnchor(): void {
  clearKey(SYNC_ANCHOR_KEY)
  clearKey(SYNC_BUILD_EPOCH_KEY)
}

export function saveSyncAnchorMs(ms: number): void {
  saveJSON(SYNC_ANCHOR_KEY, ms)
  saveJSON(SYNC_BUILD_EPOCH_KEY, BUILD_EPOCH_MS)
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
