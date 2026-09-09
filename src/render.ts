import { computeCycleState, DEFAULT_CYCLE_CONFIG, formatHMS, formatMS, formatPercent, type LedState } from './cycle.ts'
import { translate, type Lang } from './i18n.ts'

function ledClassFor(state: LedState): string {
  return state === 'green' ? 'led--on' : 'led--off'
}

function setText(doc: Document, id: string, text: string) {
  const el = doc.getElementById(id)
  if (el) el.textContent = text
}

function setBarWidth(doc: Document, id: string, percentText: string) {
  const el = doc.getElementById(id) as HTMLElement | null
  if (el) el.style.width = percentText
}

export function renderStaticConfigInfo(doc: Document, config = DEFAULT_CYCLE_CONFIG, lang: Lang = 'en') {
  const powerUpTotalMin = config.ledCount * config.powerUpMinutesPerLed
  const powerDownTotalMin = config.ledCount * config.powerDownMinutesPerLed
  const cycleTotalMin = powerUpTotalMin + powerDownTotalMin + config.cooldownMinutes

  setText(doc, 'power-up-per-led-info', translate(lang, 'info.minPerLed', { n: config.powerUpMinutesPerLed }))
  setText(doc, 'power-up-total-info', translate(lang, 'info.totalMin', { n: powerUpTotalMin }))
  setText(doc, 'power-down-per-led-info', translate(lang, 'info.minPerLed', { n: config.powerDownMinutesPerLed }))
  setText(doc, 'power-down-total-info', translate(lang, 'info.totalMin', { n: powerDownTotalMin }))
  setText(doc, 'total-cycle-value', translate(lang, 'info.totalCycleMinutes', { n: cycleTotalMin }))
  setText(doc, 'total-cycle-cooldown', translate(lang, 'info.totalCycleCooldown', { n: config.cooldownMinutes }))
  setText(doc, 'cycle-summary-chip', `CYCLE ${cycleTotalMin}M`)
}

export function renderCycleView(doc: Document, now: Date, config = DEFAULT_CYCLE_CONFIG, lang: Lang = 'en') {
  const state = computeCycleState(now, config)

  for (let i = 0; i < state.ledStates.length; i++) {
    const led = doc.getElementById(`led-${i + 1}`)
    if (!led) continue
    led.className = `led ${ledClassFor(state.ledStates[i])}`
  }

  // The "Phase" label lives in the markup as an eyebrow, so the readout
  // itself carries only the phase name.
  setText(doc, 'phase-status-total', translate(lang, `phase.${state.phase}`))
  setText(doc, 'phase-timer', formatMS(state.msRemainingInPhase))
  const phasePct = formatPercent(state.phaseDurationMs - state.msRemainingInPhase, state.phaseDurationMs)
  setBarWidth(doc, 'phase-progress-bar', phasePct)
  setText(doc, 'phase-progress-text', phasePct)

  setText(doc, 'led-time-remaining', state.currentLedIndex ? formatMS(state.msRemainingInLed) : '--m --s')
  const ledPct = state.ledDurationMs > 0 ? formatPercent(state.ledDurationMs - state.msRemainingInLed, state.ledDurationMs) : '0.00%'
  setBarWidth(doc, 'led-progress-bar', ledPct)
  setText(doc, 'led-progress-text', ledPct)

  setText(doc, 'hangar-opening-timer', state.hangarAccessible ? formatHMS(state.msRemainingInPhase) : formatHMS(state.msRemainingUntilOpen))
  setText(doc, 'hangar-opening-status', translate(lang, state.hangarAccessible ? 'status.openNow' : 'status.closed'))

  setText(doc, 'total-time-remaining', formatHMS(state.msRemainingInCycle))
  const totalPct = formatPercent(state.cycleDurationMs - state.msRemainingInCycle, state.cycleDurationMs)
  setBarWidth(doc, 'total-progress-bar', totalPct)
  setText(doc, 'total-progress-text', totalPct)

  return state
}
