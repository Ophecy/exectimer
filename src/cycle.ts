export interface CycleConfig {
  ledCount: number
  powerUpMinutesPerLed: number
  powerDownMinutesPerLed: number
  cooldownMinutes: number
  /** Any past or future instant when all LEDs are known to have just turned green (access window opening). */
  referenceAllGreenAt: Date
}

// Observed: all 5 LEDs green on 2026-09-07 13:10 Europe/Paris (CEST, UTC+2).
const FALLBACK_ALL_GREEN_AT = '2026-09-07T11:10:00Z'

/**
 * The project-wide calibration instant, baked into the build from the
 * `CYCLE_EPOCH` GitHub repository variable (an ISO 8601 instant, e.g.
 * `2026-09-07T11:10:00Z`). Publishing a fresh observation recalibrates every
 * visitor, so nobody has to run the admin sync on their own machine.
 */
function resolveBuildEpoch(): Date {
  const raw = import.meta.env?.VITE_CYCLE_EPOCH
  if (!raw) return new Date(FALLBACK_ALL_GREEN_AT)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    console.error(`[PHT-EPOCH-01] VITE_CYCLE_EPOCH is not a valid ISO 8601 instant: ${raw}`)
    return new Date(FALLBACK_ALL_GREEN_AT)
  }
  return parsed
}

export const BUILD_EPOCH_MS = resolveBuildEpoch().getTime()

export const DEFAULT_CYCLE_CONFIG: CycleConfig = {
  ledCount: 5,
  powerUpMinutesPerLed: 24,
  powerDownMinutesPerLed: 12,
  cooldownMinutes: 5,
  referenceAllGreenAt: new Date(BUILD_EPOCH_MS),
}

// A LED is only ever 'red' (off — not yet charged, or already discharged) or
// 'green' (holding, fully charged and not yet its turn to discharge). Which
// one is currently *changing* is tracked separately via currentLedIndex; it
// doesn't get its own color.
export type LedState = 'red' | 'green'
export type MacroPhase = 'power-up' | 'access' | 'cooldown'

export interface CycleState {
  phase: MacroPhase
  hangarAccessible: boolean
  ledStates: LedState[]
  currentLedIndex: number | null
  msRemainingInPhase: number
  phaseDurationMs: number
  msRemainingInLed: number
  ledDurationMs: number
  msRemainingUntilOpen: number
  msRemainingInCycle: number
  cycleDurationMs: number
}

const MINUTE_MS = 60_000

function mod(a: number, n: number): number {
  return ((a % n) + n) % n
}

export function computeCycleState(now: Date, config: CycleConfig = DEFAULT_CYCLE_CONFIG): CycleState {
  const { ledCount, powerUpMinutesPerLed, powerDownMinutesPerLed, cooldownMinutes, referenceAllGreenAt } = config

  const powerUpMs = powerUpMinutesPerLed * MINUTE_MS
  const powerDownMs = powerDownMinutesPerLed * MINUTE_MS
  const powerUpTotalMs = ledCount * powerUpMs
  const powerDownTotalMs = ledCount * powerDownMs
  const cooldownMs = cooldownMinutes * MINUTE_MS
  const cycleDurationMs = powerUpTotalMs + powerDownTotalMs + cooldownMs

  // t = 0 is the instant LED 1 starts charging (start of the power-up phase).
  const epochMs = referenceAllGreenAt.getTime() - powerUpTotalMs
  const t = mod(now.getTime() - epochMs, cycleDurationMs)

  let phase: MacroPhase
  let currentLedIndex: number | null
  let msIntoPhase: number
  let phaseDurationMs: number
  let msIntoLed = 0
  let ledDurationMs = 0

  if (t < powerUpTotalMs) {
    phase = 'power-up'
    phaseDurationMs = powerUpTotalMs
    msIntoPhase = t
    ledDurationMs = powerUpMs
    const chargedCount = Math.floor(t / powerUpMs)
    currentLedIndex = chargedCount < ledCount ? chargedCount + 1 : null
    msIntoLed = t - chargedCount * powerUpMs
  } else if (t < powerUpTotalMs + powerDownTotalMs) {
    phase = 'access'
    phaseDurationMs = powerDownTotalMs
    msIntoPhase = t - powerUpTotalMs
    ledDurationMs = powerDownMs
    const dischargedCount = Math.floor(msIntoPhase / powerDownMs)
    currentLedIndex = dischargedCount < ledCount ? dischargedCount + 1 : null
    msIntoLed = msIntoPhase - dischargedCount * powerDownMs
  } else {
    phase = 'cooldown'
    phaseDurationMs = cooldownMs
    msIntoPhase = t - powerUpTotalMs - powerDownTotalMs
    currentLedIndex = null
  }

  // LED i (0-based) is green only while holding a full charge: from the
  // instant it finishes charging until the instant its own discharge turn
  // starts. Red everywhere else — before charging completes, or once its
  // discharge has started (or finished).
  const ledStates: LedState[] = []
  for (let i = 0; i < ledCount; i++) {
    const greenStart = (i + 1) * powerUpMs
    const greenEnd = powerUpTotalMs + i * powerDownMs
    ledStates.push(t >= greenStart && t < greenEnd ? 'green' : 'red')
  }

  const hangarAccessible = phase === 'access'

  return {
    phase,
    hangarAccessible,
    ledStates,
    currentLedIndex,
    msRemainingInPhase: phaseDurationMs - msIntoPhase,
    phaseDurationMs,
    msRemainingInLed: ledDurationMs > 0 ? ledDurationMs - msIntoLed : 0,
    ledDurationMs,
    msRemainingUntilOpen: hangarAccessible ? 0 : mod(powerUpTotalMs - t, cycleDurationMs),
    msRemainingInCycle: cycleDurationMs - t,
    cycleDurationMs,
  }
}

export function formatHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

export function formatMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export function formatPercent(elapsedMs: number, totalMs: number): string {
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0
  return `${pct.toFixed(2)}%`
}
