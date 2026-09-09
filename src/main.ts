import './style.css'
import { renderCycleView, renderStaticConfigInfo } from './render.ts'
import { getEffectiveCycleConfig } from './cycleConfig.ts'
import { initLanguageSwitch, getCurrentLang, LANG_CHANGE_EVENT } from './i18n.ts'
import { initAdminPanel, renderSyncBadge } from './admin.ts'
import { initManualTimers, initZoneMaps, tickManualTimers } from './manualTimers.ts'
import { initTerminal, syncHudReadout } from './terminal.ts'

const copyrightYear = document.querySelector<HTMLElement>('#copyright-year')
if (copyrightYear) copyrightYear.textContent = String(new Date().getFullYear())

function renderAll() {
  const config = getEffectiveCycleConfig()
  const lang = getCurrentLang()
  renderStaticConfigInfo(document, config, lang)
  renderCycleView(document, new Date(), config, lang)
  tickManualTimers(document)
  syncHudReadout(document)
}

initLanguageSwitch(document)
initManualTimers(document)
initZoneMaps(document)
initAdminPanel(document)
initTerminal(document)

renderAll()
setInterval(renderAll, 1000)

document.addEventListener(LANG_CHANGE_EVENT, () => {
  // Column headers and map captions are plain text, so they need a rebuild
  // rather than the per-second patch.
  initManualTimers(document)
  initZoneMaps(document)
  renderAll()
  renderSyncBadge(document)
})
