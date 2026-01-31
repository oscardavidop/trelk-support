import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import HttpBackend from 'i18next-http-backend'
import resourcesToBackend from 'i18next-resources-to-backend'

const LANG_KEY = 'support_dashboard_lang'
const SUPPORTED_LANGS = ['es', 'en', 'pt'] as const
type Lang = typeof SUPPORTED_LANGS[number]

function detectLanguage(): Lang {
    const stored = localStorage.getItem(LANG_KEY)
    if (stored && SUPPORTED_LANGS.includes(stored as Lang)) {
        return stored as Lang
    }

    const nav = navigator.language.split('-')[0]
    if (SUPPORTED_LANGS.includes(nav as Lang)) {
        return nav as Lang
    }

    return 'es'
}

export function setLanguage(lang: Lang) {
    localStorage.setItem(LANG_KEY, lang)
    i18n.changeLanguage(lang)
}

export function getLanguage() {
    return i18n.language
}

const isProd =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost'

if (isProd) {
    i18n.use(
        resourcesToBackend((lng: string, ns: string) =>
            import(`./locales/${lng}/${ns}.json`)
        )
    )
} else {
    i18n.use(HttpBackend)
}

i18n
    .use(initReactI18next)
    .init({
        lng: detectLanguage(),
        fallbackLng: 'es',
        ns: ['common'],
        defaultNS: 'common',
        preload: [detectLanguage()],
        react: {
            useSuspense: false,
        },
        interpolation: {
            escapeValue: false,
        },
        load: 'currentOnly',
        debug: false,
    })


export default i18n
