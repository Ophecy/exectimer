import {
  getEffectiveCycleConfig,
  loadDurationOverrides,
  saveDurationOverrides,
  clearDurationOverrides,
  saveSyncAnchorMs,
  type CycleDurationOverrides,
} from './cycleConfig.ts'
import { renderCycleView, renderStaticConfigInfo } from './render.ts'
import { startAllPaused, resetAllTimers } from './manualTimers.ts'
import { loadJSON, saveJSON } from './storage.ts'
import { getCurrentLang, translate } from './i18n.ts'

const LAST_SYNC_KEY = 'last-sync-ms'

function rerenderCycle(doc: Document): void {
  const config = getEffectiveCycleConfig()
  const lang = getCurrentLang()
  renderStaticConfigInfo(doc, config, lang)
  renderCycleView(doc, new Date(), config, lang)
}

export function renderSyncBadge(doc: Document): void {
  const el = doc.getElementById('timestamp-badge')
  if (!el) return
  const lang = getCurrentLang()
  const lastSync = loadJSON<number | null>(LAST_SYNC_KEY, null)
  const timeText =
    lastSync !== null
      ? new Date(lastSync).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
      : translate(lang, 'sync.never')
  el.textContent = `${translate(lang, 'sync.label')}: ${timeText}`
}

function setDurationInputs(doc: Document): void {
  const config = getEffectiveCycleConfig()
  const powerUp = doc.getElementById('admin-power-up-input') as HTMLInputElement | null
  const powerDown = doc.getElementById('admin-power-down-input') as HTMLInputElement | null
  const cooldown = doc.getElementById('admin-cooldown-input') as HTMLInputElement | null
  if (powerUp) powerUp.value = String(config.powerUpMinutesPerLed)
  if (powerDown) powerDown.value = String(config.powerDownMinutesPerLed)
  if (cooldown) cooldown.value = String(config.cooldownMinutes)
}

function bindDurationInput(doc: Document, id: string, applyValue: (overrides: CycleDurationOverrides, value: number) => void): void {
  const input = doc.getElementById(id) as HTMLInputElement | null
  if (!input) return
  input.addEventListener('change', () => {
    const value = Number(input.value)
    if (Number.isFinite(value) && value > 0) {
      const overrides = loadDurationOverrides()
      applyValue(overrides, value)
      saveDurationOverrides(overrides)
      rerenderCycle(doc)
    } else {
      setDurationInputs(doc)
    }
  })
}

export function initAdminPanel(doc: Document): void {
  const panel = doc.getElementById('admin-controls')
  const openButton = doc.getElementById('open-admin-sidebar')
  const closeButton = doc.getElementById('close-admin-sidebar')
  const scrim = doc.getElementById('admin-scrim')

  // The drawer's visibility is driven by a data attribute on <body>, so the CSS
  // owns the transition and no timer has to guess when it ends.
  function setPanel(open: boolean): void {
    doc.body.dataset.admin = open ? 'open' : 'closed'
    panel?.setAttribute('aria-hidden', String(!open))
    openButton?.setAttribute('aria-expanded', String(open))
    ;(open ? closeButton : openButton)?.focus()
  }

  openButton?.addEventListener('click', () => setPanel(true))
  closeButton?.addEventListener('click', () => setPanel(false))
  scrim?.addEventListener('click', () => setPanel(false))
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && doc.body.dataset.admin === 'open') setPanel(false)
  })

  doc.getElementById('admin-sync-btn')?.addEventListener('click', () => {
    const now = Date.now()
    saveSyncAnchorMs(now)
    saveJSON(LAST_SYNC_KEY, now)
    renderSyncBadge(doc)
    rerenderCycle(doc)
  })

  doc.getElementById('admin-start-timer-btn')?.addEventListener('click', () => startAllPaused(doc))
  doc.getElementById('admin-reset-timer-btn')?.addEventListener('click', () => resetAllTimers(doc))
  doc.getElementById('admin-restore-defaults-btn')?.addEventListener('click', () => {
    clearDurationOverrides()
    setDurationInputs(doc)
    rerenderCycle(doc)
  })

  setDurationInputs(doc)
  bindDurationInput(doc, 'admin-power-up-input', (o, v) => (o.powerUpMinutesPerLed = v))
  bindDurationInput(doc, 'admin-power-down-input', (o, v) => (o.powerDownMinutesPerLed = v))
  bindDurationInput(doc, 'admin-cooldown-input', (o, v) => (o.cooldownMinutes = v))

  renderSyncBadge(doc)
}
