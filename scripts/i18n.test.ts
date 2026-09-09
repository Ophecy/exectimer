// Standalone self-check for the i18n dictionaries — no test framework needed.
// Run with: node --experimental-strip-types scripts/i18n.test.ts
import assert from 'node:assert/strict'
import { translate, LANGUAGES } from '../src/i18n.ts'

assert.ok(LANGUAGES.length >= 10, 'expected at least 10 languages')

// Both keys and values are read through translate(), so probe every key we
// expect to exist by round-tripping a handful of representative ones per
// language rather than reaching into the private dictionary object.
const sampleKeys = [
  'header.subtitle',
  'header.langSelectLabel',
  'sync.label',
  'panel.hangar',
  'phase.power-up',
  'phase.access',
  'phase.cooldown',
  'status.openNow',
  'status.closed',
  'czt.terminal',
  'czt.status.running',
  'faq.q1',
  'admin.startTimer',
  'footer.fanMade',
]

for (const { code } of LANGUAGES) {
  for (const key of sampleKeys) {
    // A missing key falls back to the key itself — catch that regression here.
    assert.notEqual(translate(code, key), key, `missing ${code} translation for ${key}`)
  }
}

// Interpolation substitutes {n}/{name} placeholders.
assert.equal(translate('en', 'info.minPerLed', { n: 24 }), '24 Min per LED')
assert.equal(translate('de', 'info.minPerLed', { n: 24 }), '24 Min pro LED')
assert.equal(translate('en', 'czt.setLabel', { name: 'Terminal' }), 'Set Terminal timer')

// Unknown keys fall back to the key itself rather than throwing.
assert.equal(translate('en', 'this.key.does.not.exist'), 'this.key.does.not.exist')

console.log('i18n.test.ts: all checks passed')
