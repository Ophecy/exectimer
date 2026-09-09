import { DEFAULT_CYCLE_CONFIG, type CycleConfig } from './cycle.ts'
import { loadJSON, saveJSON, clearKey } from './storage.ts'

export interface CycleDurationOverrides {
  powerUpMinutesPerLed?: number
  powerDownMinutesPerLed?: number
  cooldownMinutes?: number
}

const DURATIONS_KEY = 'cycle-durations'
const SYNC_ANCHOR_KEY = 'sync-anchor-ms'

export function loadDurationOverrides(): CycleDurationOverrides {
  return loadJSON<CycleDurationOverrides>(DURATIONS_KEY, {})
}

export function saveDurationOverrides(overrides: CycleDurationOverrides): void {
  saveJSON(DURATIONS_KEY, overrides)
}

export function clearDurationOverrides(): void {
  clearKey(DURATIONS_KEY)
}

export function loadSyncAnchorMs(): number | null {
  return loadJSON<number | null>(SYNC_ANCHOR_KEY, null)
}

export function saveSyncAnchorMs(ms: number): void {
  saveJSON(SYNC_ANCHOR_KEY, ms)
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
