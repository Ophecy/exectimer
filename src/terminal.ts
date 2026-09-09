import { loadJSON, saveJSON } from './storage.ts'

/**
 * Terminal chrome: the hardware around the amber screen. Section rail,
 * the hangar readout that takes over the title bar, and the grime toggle.
 * No business logic — it only mirrors what `render.ts` has already written.
 */

const GRIME_KEY = 'grime'

/** Mirrors the live hangar readout into the title bar. Called on every tick. */
export function syncHudReadout(doc: Document): void {
  const time = doc.getElementById('hud-time')
  const source = doc.getElementById('hangar-opening-timer')
  if (time && source) time.textContent = source.textContent

  const phase = doc.getElementById('hud-phase')
  const phaseSource = doc.getElementById('phase-status-total')
  if (phase && phaseSource) phase.textContent = phaseSource.textContent

  const dots = doc.querySelectorAll<HTMLElement>('#hud-leds i')
  dots.forEach((dot, i) => {
    const led = doc.getElementById(`led-${i + 1}`)
    dot.classList.toggle('on', led?.classList.contains('led--on') ?? false)
  })
}

function initRailAndHud(doc: Document): void {
  const scroller = doc.getElementById('scroll')
  if (!scroller) return

  const buttons = [...doc.querySelectorAll<HTMLElement>('.rail-btn')]
  const sections = buttons.map((b) => doc.getElementById(b.dataset.goto ?? ''))

  buttons.forEach((button, i) => {
    button.addEventListener('click', () => {
      const target = sections[i]
      if (target) scroller.scrollTop = target.offsetTop
    })
  })

  const hud = doc.getElementById('hud')
  const countdown = doc.getElementById('hangar-opening-timer')
  hud?.addEventListener('click', () => {
    scroller.scrollTop = 0
  })

  function sync(): void {
    // rail: the last section whose top has passed the fold is the current one
    let active = 0
    const fold = scroller!.scrollTop + 140
    sections.forEach((section, i) => {
      if (section && section.offsetTop <= fold) active = i
    })
    buttons.forEach((button, i) => button.setAttribute('aria-current', String(i === active)))

    // readout: the countdown is the one figure you always need, so it moves
    // into the title bar as soon as the real one leaves the screen
    if (hud && countdown) {
      const gone = scroller!.scrollTop > countdown.offsetTop + countdown.offsetHeight
      hud.classList.toggle('is-on', gone)
    }
  }

  scroller.addEventListener('scroll', sync, { passive: true })
  sync()
}

function initGrimeToggle(doc: Document): void {
  const button = doc.getElementById('grime-toggle')
  if (!button) return

  function apply(on: boolean): void {
    doc.body.dataset.grime = on ? 'on' : 'off'
    button!.setAttribute('aria-pressed', String(on))
    saveJSON(GRIME_KEY, on)
  }

  apply(loadJSON<boolean>(GRIME_KEY, true))
  button.addEventListener('click', () => apply(button.getAttribute('aria-pressed') !== 'true'))
}

export function initTerminal(doc: Document): void {
  initRailAndHud(doc)
  initGrimeToggle(doc)
}
