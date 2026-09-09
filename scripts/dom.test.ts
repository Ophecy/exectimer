// Integration self-check: loads the real index.html into jsdom and confirms
// the render layer actually reads/writes the elements the markup exposes.
// Run with: node --experimental-strip-types scripts/dom.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { renderCycleView, renderStaticConfigInfo } from '../src/render.ts'
import { DEFAULT_CYCLE_CONFIG } from '../src/cycle.ts'

const indexPath = fileURLToPath(new URL('../index.html', import.meta.url))
const html = readFileSync(indexPath, 'utf-8')
const dom = new JSDOM(html)
const { document } = dom.window

renderStaticConfigInfo(document)
assert.equal(document.getElementById('power-up-per-led-info')?.textContent, '24 Min per LED')
assert.equal(document.getElementById('power-up-total-info')?.textContent, 'Total: 120 min')
assert.equal(document.getElementById('cycle-summary-chip')?.textContent, 'CYCLE 185M')

const anchor = DEFAULT_CYCLE_CONFIG.referenceAllGreenAt
const stateAtAnchor = renderCycleView(document, anchor)
assert.equal(stateAtAnchor.phase, 'access')
assert.equal(document.getElementById('hangar-opening-status')?.textContent, 'Open now')
// The "Phase" label is an eyebrow in the markup, so the readout holds the name alone.
assert.equal(document.getElementById('phase-status-total')?.textContent, 'Access Window')
assert.equal(document.getElementById('led-1')?.className, 'led led--off')
assert.equal(document.getElementById('led-2')?.className, 'led led--on')
// jsdom's CSSOM normalizes "0.00%" to "0%" on the style property (the text
// label keeps full precision) — assert against the normalized form.
assert.equal((document.getElementById('phase-progress-bar') as any).style.width, '0%')
assert.equal(document.getElementById('phase-progress-text')?.textContent, '0.00%')

// One minute later: LED1's discharge progress bar should have advanced, and
// the total-cycle progress bar (a distinct element) should differ from it.
const stateOneMinLater = renderCycleView(document, new Date(anchor.getTime() + 60_000))
assert.equal(stateOneMinLater.phase, 'access')
const phaseBarWidth = (document.getElementById('phase-progress-bar') as any).style.width
assert.notEqual(phaseBarWidth, '0%')

// Cooldown: no current LED, and all LEDs are red (dead zone) — a LED that
// already discharged does not get a distinct "done" color.
const cooldownInstant = new Date(anchor.getTime() + 62 * 60_000) // 60min access + 2min into the 5min cooldown
const cooldownState = renderCycleView(document, cooldownInstant)
assert.equal(cooldownState.phase, 'cooldown')
assert.equal(document.getElementById('led-time-remaining')?.textContent, '--m --s')
for (let i = 1; i <= 5; i++) {
  assert.equal(document.getElementById(`led-${i}`)?.className, 'led led--off')
}

console.log('dom.test.ts: all checks passed')
