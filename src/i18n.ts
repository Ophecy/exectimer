import { loadJSON, saveJSON } from './storage.ts'
import en from './locales/en.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import es from './locales/es.json'
import pt from './locales/pt.json'
import it from './locales/it.json'
import ru from './locales/ru.json'
import pl from './locales/pl.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'

// Native-name labels, in switcher order. Single source of truth: the <select>
// options are generated from this list, and Lang is derived from it too.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
  { code: 'pl', label: 'Polski' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
] as const

export type Lang = (typeof LANGUAGES)[number]['code']

type Dict = Record<string, string>

const DICTIONARIES: Record<Lang, Dict> = { en, fr, de, es, pt, it, ru, pl, zh, ja }

const STORAGE_KEY = 'lang'
export const LANG_CHANGE_EVENT = 'pht:langchange'

let currentLang: Lang = 'en'

function isLang(value: string | null): value is Lang {
  return value !== null && LANGUAGES.some((l) => l.code === value)
}

export function getCurrentLang(): Lang {
  return currentLang
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const raw = DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''))
}

export function applyLanguage(doc: Document, lang: Lang): void {
  doc.documentElement.lang = lang
  doc.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    if (key) el.textContent = translate(lang, key)
  })
  doc.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    const spec = el.dataset.i18nAttr
    if (!spec) return
    for (const pair of spec.split(',')) {
      const [attr, key] = pair.split(':')
      if (attr && key) el.setAttribute(attr, translate(lang, key))
    }
  })
}

export function initLanguageSwitch(doc: Document): Lang {
  const stored = loadJSON<string | null>(STORAGE_KEY, null)
  currentLang = isLang(stored) ? stored : 'en'

  const select = doc.querySelector<HTMLSelectElement>('#lang-select')
  if (select) {
    select.replaceChildren()
    for (const { code, label } of LANGUAGES) {
      const option = doc.createElement('option')
      option.value = code
      option.textContent = label
      select.appendChild(option)
    }
    select.value = currentLang

    select.addEventListener('change', () => {
      const lang: Lang = isLang(select.value) ? select.value : 'en'
      if (lang === currentLang) return
      currentLang = lang
      applyLanguage(doc, lang)
      saveJSON(STORAGE_KEY, lang)
      doc.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT))
    })
  }

  applyLanguage(doc, currentLang)
  return currentLang
}
