import { loadJSON, saveJSON, clearKey } from './storage.ts'
import { getCurrentLang, translate, type Lang } from './i18n.ts'

export type ZoneKey = 'checkmate' | 'orbituary' | 'ruinstation'
export const ZONE_KEYS: ZoneKey[] = ['checkmate', 'orbituary', 'ruinstation']

const ZONE_NAMES: Record<ZoneKey, string> = {
  checkmate: 'Checkmate Station',
  orbituary: 'Orbituary',
  ruinstation: 'Ruin Station',
}

// ASOP-style sector plans redrawn from the community contested-zone maps by
// u/Zane_DragonBorn (credited on each plate). Vector on purpose: the modal
// zooms and pans them, and the ink-on-amber line work matches the terminal.
const BASE = import.meta.env.BASE_URL
const ZONE_MAP_SRC: Record<ZoneKey, string> = {
  checkmate: `${BASE}maps/checkmate.svg`,
  orbituary: `${BASE}maps/orbituary.svg`,
  ruinstation: `${BASE}maps/ruinstation.svg`,
}

export type StationCategory = 'keycard' | 'compboard'

const KEYCARD_MS = 15 * 60_000
const COMPBOARD_MS = 30 * 60_000

interface StationDef {
  id: string
  name: string
  category: StationCategory
  durationMs: number
}

// Real Pyro contested-zone layout: keycard doors take 15 min, compboards take 30 min.
const ZONE_STATIONS: Record<ZoneKey, StationDef[]> = {
  checkmate: [
    { id: 'terminal-1', name: 'Terminal 1', category: 'keycard', durationMs: KEYCARD_MS },
    { id: 'terminal-2', name: 'Terminal 2', category: 'keycard', durationMs: KEYCARD_MS },
    { id: 'terminal-3', name: 'Terminal 3', category: 'keycard', durationMs: KEYCARD_MS },
    { id: 'tablet-1', name: 'Tablet 1', category: 'compboard', durationMs: COMPBOARD_MS },
    { id: 'tablet-2', name: 'Tablet 2', category: 'compboard', durationMs: COMPBOARD_MS },
    { id: 'tablet-3', name: 'Tablet 3', category: 'compboard', durationMs: COMPBOARD_MS },
  ],
  orbituary: [
    { id: 'terminal-1', name: 'Terminal 1', category: 'keycard', durationMs: KEYCARD_MS },
    { id: 'terminal-2', name: 'Terminal 2', category: 'keycard', durationMs: KEYCARD_MS },
    { id: 'tablet-4', name: 'Tablet 4', category: 'compboard', durationMs: COMPBOARD_MS },
    { id: 'tablet-7', name: 'Tablet 7', category: 'compboard', durationMs: COMPBOARD_MS },
  ],
  ruinstation: [
    { id: 'crypt', name: 'The Crypt', category: 'keycard', durationMs: KEYCARD_MS },
    { id: 'lastresort', name: 'The Last Resort', category: 'keycard', durationMs: KEYCARD_MS },
    { id: 'wasteland', name: 'The Wasteland', category: 'keycard', durationMs: KEYCARD_MS },
    { id: 'tablet-5', name: 'Tablet 5', category: 'compboard', durationMs: COMPBOARD_MS },
    { id: 'tablet-6', name: 'Tablet 6', category: 'compboard', durationMs: COMPBOARD_MS },
  ],
}

const MINUTE_STEP_MS = 60_000

export interface CztState {
  durationMs: number
  remainingMs: number // snapshot remaining as of updatedAt
  running: boolean
  updatedAt: number // epoch ms
}

export interface Station {
  id: string
  name: string
  category: StationCategory
  defaultDurationMs: number
  state: CztState
}

export type ZoneStore = Record<ZoneKey, Station[]>
export type CztStatus = 'idle' | 'running' | 'expired'

const STORAGE_KEY = 'zone-timers-v2'

function defaultState(durationMs: number, nowMs: number): CztState {
  return { durationMs, remainingMs: durationMs, running: false, updatedAt: nowMs }
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function liveRemainingMs(state: CztState, nowMs: number): number {
  if (!state.running) return state.remainingMs
  return Math.max(0, state.remainingMs - (nowMs - state.updatedAt))
}

export function statusFor(state: CztState, nowMs: number): CztStatus {
  if (liveRemainingMs(state, nowMs) <= 0) return 'expired'
  return state.running ? 'running' : 'idle'
}

/** Merges saved timer state onto the fixed station layout, so code changes to durations/names stay authoritative. */
export function loadStore(): ZoneStore {
  const saved = loadJSON<Partial<Record<ZoneKey, Station[]>>>(STORAGE_KEY, {})
  const now = Date.now()
  const store = {} as ZoneStore
  for (const zone of ZONE_KEYS) {
    const savedStations = saved[zone] ?? []
    store[zone] = ZONE_STATIONS[zone].map((def) => {
      const existing = savedStations.find((s) => s.id === def.id)
      return {
        id: def.id,
        name: def.name,
        category: def.category,
        defaultDurationMs: def.durationMs,
        state: existing?.state ?? defaultState(def.durationMs, now),
      }
    })
  }
  return store
}

export function saveStore(store: ZoneStore): void {
  saveJSON(STORAGE_KEY, store)
}

export function clearStore(): void {
  clearKey(STORAGE_KEY)
}

function updateStation(store: ZoneStore, zone: ZoneKey, id: string, update: (s: Station) => Station): ZoneStore {
  return { ...store, [zone]: store[zone].map((s) => (s.id === id ? update(s) : s)) }
}

export function startStation(store: ZoneStore, zone: ZoneKey, id: string, nowMs: number): ZoneStore {
  return updateStation(store, zone, id, (s) => {
    const remaining = liveRemainingMs(s.state, nowMs)
    const base = remaining > 0 ? remaining : s.defaultDurationMs
    return { ...s, state: { durationMs: base, remainingMs: base, running: true, updatedAt: nowMs } }
  })
}

export function pauseStation(store: ZoneStore, zone: ZoneKey, id: string, nowMs: number): ZoneStore {
  return updateStation(store, zone, id, (s) => {
    const remaining = liveRemainingMs(s.state, nowMs)
    return { ...s, state: { durationMs: s.state.durationMs, remainingMs: remaining, running: false, updatedAt: nowMs } }
  })
}

export function resetStation(store: ZoneStore, zone: ZoneKey, id: string, nowMs: number): ZoneStore {
  return updateStation(store, zone, id, (s) => ({ ...s, state: defaultState(s.defaultDurationMs, nowMs) }))
}

export function adjustStationDuration(store: ZoneStore, zone: ZoneKey, id: string, deltaMs: number, nowMs: number): ZoneStore {
  return updateStation(store, zone, id, (s) => {
    if (s.state.running) return s
    const next = Math.min(s.defaultDurationMs, Math.max(0, liveRemainingMs(s.state, nowMs) + deltaMs))
    return { ...s, state: { durationMs: next, remainingMs: next, running: false, updatedAt: nowMs } }
  })
}

export function resumeAllIdle(store: ZoneStore, nowMs: number): ZoneStore {
  const next = {} as ZoneStore
  for (const zone of ZONE_KEYS) {
    next[zone] = store[zone].map((s) => {
      if (s.state.running) return s
      const remaining = liveRemainingMs(s.state, nowMs)
      const base = remaining > 0 ? remaining : s.defaultDurationMs
      return { ...s, state: { durationMs: base, remainingMs: base, running: true, updatedAt: nowMs } }
    })
  }
  return next
}

/** Resets every station back to its preset duration. */
export function resetAllTimerValues(store: ZoneStore, nowMs: number): ZoneStore {
  const next = {} as ZoneStore
  for (const zone of ZONE_KEYS) {
    next[zone] = store[zone].map((s) => ({ ...s, state: defaultState(s.defaultDurationMs, nowMs) }))
  }
  return next
}

/* ============================================================
   Rendering
   ============================================================ */

let activeZone: ZoneKey = ZONE_KEYS[0]

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function applyActiveZone(doc: Document): void {
  doc.querySelectorAll<HTMLElement>('[data-zone-tab]').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.zoneTab === activeZone))
  })
  doc.querySelectorAll<HTMLElement>('[data-zone-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.zonePanel !== activeZone
  })
}

function buildTabs(doc: Document): void {
  const host = doc.getElementById('czt-zone-tabs')
  if (!host) return
  host.replaceChildren()

  for (const zone of ZONE_KEYS) {
    const tab = el(doc, 'button', 'zone-tab', ZONE_NAMES[zone])
    tab.type = 'button'
    tab.dataset.zoneTab = zone
    tab.setAttribute('role', 'tab')
    tab.addEventListener('click', () => {
      activeZone = zone
      applyActiveZone(doc)
    })
    host.appendChild(tab)
  }
}

/** Re-reads the store at click time, so a patched row never acts on a stale snapshot. */
function commit(doc: Document, next: ZoneStore): void {
  saveStore(next)
  patchManualTimers(doc, next, Date.now(), getCurrentLang())
}

function buildStationCard(doc: Document, zone: ZoneKey, station: StationDef): HTMLElement {
  const card = el(doc, 'div', 'czt-card')
  card.dataset.zone = zone
  card.dataset.station = station.id

  const head = el(doc, 'div', 'czt-card-head')
  head.appendChild(el(doc, 'span', 'name', station.name))
  const meta = el(doc, 'span', 'meta')
  meta.dataset.cell = 'meta'
  head.appendChild(meta)
  card.appendChild(head)

  const statusLine = el(doc, 'div', 'czt-card-status')
  statusLine.appendChild(el(doc, 'i', 'czt-dot'))
  const status = el(doc, 'span', 'czt-status')
  status.dataset.cell = 'status'
  statusLine.appendChild(status)
  card.appendChild(statusLine)

  // stepper — adjusts the timer by one minute while it is stopped
  const stepper = el(doc, 'div', 'czt-stepper')
  const adjust = (deltaMs: number) =>
    commit(doc, adjustStationDuration(loadStore(), zone, station.id, deltaMs, Date.now()))

  const dec = el(doc, 'button', 'czt-stepper-btn', '−')
  dec.type = 'button'
  dec.dataset.cell = 'dec'
  dec.addEventListener('click', () => adjust(-MINUTE_STEP_MS))

  const value = el(doc, 'span', 'czt-stepper-value')
  value.dataset.cell = 'remaining'

  const inc = el(doc, 'button', 'czt-stepper-btn', '+')
  inc.type = 'button'
  inc.dataset.cell = 'inc'
  inc.addEventListener('click', () => adjust(MINUTE_STEP_MS))

  stepper.append(dec, value, inc)
  card.appendChild(stepper)

  const actions = el(doc, 'div', 'czt-card-actions')

  const toggle = el(doc, 'button', 'btn btn--sm')
  toggle.type = 'button'
  toggle.dataset.cell = 'toggle'
  toggle.addEventListener('click', () => {
    const store = loadStore()
    const now = Date.now()
    const running = store[zone].find((s) => s.id === station.id)?.state.running ?? false
    commit(doc, running ? pauseStation(store, zone, station.id, now) : startStation(store, zone, station.id, now))
  })

  const reset = el(doc, 'button', 'btn btn--sm btn--quiet')
  reset.type = 'button'
  reset.dataset.cell = 'reset'
  reset.addEventListener('click', () => commit(doc, resetStation(loadStore(), zone, station.id, Date.now())))

  actions.append(toggle, reset)
  card.appendChild(actions)
  return card
}

function buildZonePanel(doc: Document, zone: ZoneKey): HTMLElement {
  const panel = el(doc, 'div', 'czt-grid')
  panel.dataset.zonePanel = zone
  for (const station of ZONE_STATIONS[zone]) panel.appendChild(buildStationCard(doc, zone, station))
  return panel
}

/** Updates only what changes each second — never rebuilds, so keyboard focus survives. */
export function patchManualTimers(doc: Document, store: ZoneStore, nowMs: number, lang: Lang): void {
  for (const zone of ZONE_KEYS) {
    for (const station of store[zone]) {
      const card = doc.querySelector<HTMLElement>(`.czt-card[data-zone="${zone}"][data-station="${station.id}"]`)
      if (!card) continue

      const remaining = liveRemainingMs(station.state, nowMs)
      const status = statusFor(station.state, nowMs)
      const running = station.state.running

      card.dataset.cztStatus = status

      const find = (name: string) => card.querySelector<HTMLElement>(`[data-cell="${name}"]`)

      // type and preset share one line — the card has no column headers to lean on
      const meta = find('meta')
      if (meta) {
        meta.textContent = `${translate(lang, `type.${station.category}`)} · ${formatClock(station.defaultDurationMs)}`
      }

      const statusEl = find('status')
      if (statusEl) statusEl.textContent = translate(lang, `czt.status.${status}`)

      const value = find('remaining')
      if (value) value.textContent = formatClock(remaining)

      // A step is offered only when it would actually change something: the
      // timer must be stopped, and there has to be room left in that direction.
      for (const [name, key, atLimit] of [
        ['dec', 'czt.decreaseMinuteLabel', remaining <= 0],
        ['inc', 'czt.increaseMinuteLabel', remaining >= station.defaultDurationMs],
      ] as const) {
        const button = find(name) as HTMLButtonElement | null
        if (!button) continue
        button.disabled = running || atLimit
        button.setAttribute('aria-label', translate(lang, key, { name: station.name }))
      }

      const toggle = find('toggle')
      if (toggle) {
        toggle.textContent = translate(lang, running ? 'czt.stop' : 'czt.start')
        toggle.setAttribute('aria-label', translate(lang, running ? 'czt.stopLabel' : 'czt.startLabel', { name: station.name }))
      }

      const reset = find('reset')
      if (reset) {
        reset.textContent = translate(lang, 'czt.reset')
        reset.setAttribute('aria-label', translate(lang, 'czt.resetLabel', { name: station.name }))
      }
    }
  }
}

/** Full rebuild. Only needed on init and on language change (column headers are static text). */
export function renderManualTimers(doc: Document, store: ZoneStore, nowMs: number, lang: Lang): void {
  const container = doc.getElementById('czt-zones')
  if (!container) return

  buildTabs(doc)
  container.replaceChildren()
  for (const zone of ZONE_KEYS) container.appendChild(buildZonePanel(doc, zone))
  applyActiveZone(doc)
  patchManualTimers(doc, store, nowMs, lang)
}

export function initManualTimers(doc: Document): void {
  renderManualTimers(doc, loadStore(), Date.now(), getCurrentLang())
}

export function tickManualTimers(doc: Document): void {
  patchManualTimers(doc, loadStore(), Date.now(), getCurrentLang())
}

export function startAllPaused(doc: Document): void {
  const store = resumeAllIdle(loadStore(), Date.now())
  commit(doc, store)
}

export function resetAllTimers(doc: Document): void {
  const store = resetAllTimerValues(loadStore(), Date.now())
  commit(doc, store)
}

/* ============================================================
   Zone maps — cards plus the zoom/pan modal
   ============================================================ */

export function initZoneMaps(doc: Document): void {
  const host = doc.getElementById('czt-maps')
  if (!host) return
  const lang = getCurrentLang()
  host.replaceChildren()

  for (const zone of ZONE_KEYS) {
    const stations = ZONE_STATIONS[zone]
    const keycard = stations.filter((s) => s.category === 'keycard').length
    const compboard = stations.filter((s) => s.category === 'compboard').length

    const card = el(doc, 'button', 'map')
    card.type = 'button'
    card.dataset.zoneMap = zone
    card.setAttribute('aria-label', translate(lang, 'maps.openLabel', { name: ZONE_NAMES[zone] }))
    card.addEventListener('click', () => openMapModal(doc, zone))

    const head = el(doc, 'span', 'map-head')
    head.append(
      el(doc, 'span', 'map-title', ZONE_NAMES[zone]),
      el(doc, 'span', 'chip', translate(lang, 'maps.stationCount', { n: stations.length })),
    )

    const img = doc.createElement('img')
    img.src = ZONE_MAP_SRC[zone]
    img.alt = ''
    img.loading = 'lazy'

    const foot = el(doc, 'span', 'map-foot')
    foot.append(
      el(doc, 'span', 'lbl', translate(lang, 'maps.counts', { keycard, compboard })),
      el(doc, 'span', 'btn btn--sm btn--quiet', translate(lang, 'maps.open')),
    )

    card.append(head, img, foot)
    host.appendChild(card)
  }
}

let mapModal: HTMLElement | null = null
let mapModalImg: HTMLImageElement | null = null
let mapOpenedFrom: ZoneKey | null = null
let mapScale = 1
let mapTx = 0
let mapTy = 0
let mapDragging = false
let mapDragged = false
let mapDragStartX = 0
let mapDragStartY = 0
let mapDragStartTx = 0
let mapDragStartTy = 0

function applyMapTransform(): void {
  if (mapModalImg) mapModalImg.style.transform = `translate(${mapTx}px, ${mapTy}px) scale(${mapScale})`
}

function buildMapModal(doc: Document): HTMLElement {
  const modal = el(doc, 'div', 'czt-map-modal')
  modal.style.display = 'none'

  const closeBtn = el(doc, 'button', 'czt-map-modal-close', '×')
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', translate(getCurrentLang(), 'maps.close'))
  closeBtn.addEventListener('click', () => closeMapModal())

  const viewport = el(doc, 'div', 'czt-map-modal-viewport')

  const img = doc.createElement('img')
  img.className = 'czt-map-modal-img'
  img.alt = ''
  mapModalImg = img

  viewport.appendChild(img)
  modal.append(closeBtn, viewport)

  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      mapScale = Math.min(6, Math.max(1, mapScale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
      if (mapScale === 1) {
        mapTx = 0
        mapTy = 0
      }
      applyMapTransform()
    },
    { passive: false },
  )

  viewport.addEventListener('pointerdown', (e) => {
    mapDragging = true
    mapDragged = false
    mapDragStartX = e.clientX
    mapDragStartY = e.clientY
    mapDragStartTx = mapTx
    mapDragStartTy = mapTy
    viewport.setPointerCapture(e.pointerId)
  })
  viewport.addEventListener('pointermove', (e) => {
    if (!mapDragging) return
    const dx = e.clientX - mapDragStartX
    const dy = e.clientY - mapDragStartY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) mapDragged = true
    mapTx = mapDragStartTx + dx
    mapTy = mapDragStartTy + dy
    applyMapTransform()
  })
  viewport.addEventListener('pointerup', () => {
    mapDragging = false
  })
  viewport.addEventListener('pointercancel', () => {
    mapDragging = false
  })

  // clicking the backdrop closes; a pan that ends off the plate does not
  viewport.addEventListener('click', (e) => {
    if (e.target !== img && !mapDragged) closeMapModal()
  })

  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMapModal()
  })

  doc.body.appendChild(modal)
  return modal
}

function openMapModal(doc: Document, zone: ZoneKey): void {
  const modal = mapModal ?? buildMapModal(doc)
  mapModal = modal
  if (!mapModalImg) return
  mapModalImg.src = ZONE_MAP_SRC[zone]
  mapModalImg.alt = ZONE_NAMES[zone]
  mapScale = 1
  mapTx = 0
  mapTy = 0
  applyMapTransform()
  modal.style.display = 'flex'
  mapOpenedFrom = zone
  modal.querySelector<HTMLElement>('.czt-map-modal-close')?.focus()
}

function closeMapModal(): void {
  if (!mapModal || mapModal.style.display === 'none') return
  mapModal.style.display = 'none'
  if (mapOpenedFrom) {
    document.querySelector<HTMLElement>(`[data-zone-map="${mapOpenedFrom}"]`)?.focus()
    mapOpenedFrom = null
  }
}
