// ════════════════════════════════════════════════════════════════
// i18n — internaționalizare (react-i18next).
//
// Limbi: RO (implicit, piața actuală) + EN (fallback universal).
// Folosit în DOUĂ feluri:
//   • în componente:  const { t } = useTranslation(); t("email.colProduct")
//   • în cod „pur" (ex: builder-ul de email, în afara React):
//                     i18n.t("email.colProduct", { lng: "en" })
//
// STRUCTURĂ: un singur namespace ("translation"), dar conținutul e
// împărțit pe fișiere-feature în locales/{ro,en}/<feature>.json
// (email, nav, common, calculator, …). Le adunăm automat cu
// import.meta.glob — adăugarea unui fișier nou NU cere editarea
// acestui fișier, iar traducerea în paralel nu produce conflicte.
//
// `escapeValue: false` — construim și HTML de email manual (controlat de noi),
// iar în componente React face deja escaping, deci nu vrem dublu-escape.
// ════════════════════════════════════════════════════════════════
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const SUPPORTED_LANGS = ["ro", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const LANG_STORAGE_KEY = "aromatool-lang";

// Adună toate fișierele-feature ale unei limbi într-un singur obiect,
// unde cheia de nivel 1 = numele fișierului (ex: nav.json → "nav").
function loadLang(modules: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const file = path.split("/").pop() ?? "";
    const ns = file.replace(/\.json$/, "");
    if (ns) out[ns] = (mod as { default?: unknown }).default ?? mod;
  }
  return out;
}

const roModules = import.meta.glob("./locales/ro/*.json", { eager: true });
const enModules = import.meta.glob("./locales/en/*.json", { eager: true });

// Limba interfeței liderului: preferință salvată → altfel română (utilizatorii
// actuali sunt din RO; se poate schimba din Setări). Emailul către client NU
// folosește asta — primește limba explicit (derivată din țara catalogului).
function detectUiLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) {
      return saved as Lang;
    }
  } catch {
    // localStorage indisponibil → cădem pe default
  }
  return "ro";
}

i18n.use(initReactI18next).init({
  resources: {
    ro: { translation: loadLang(roModules) },
    en: { translation: loadLang(enModules) },
  },
  lng: detectUiLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Schimbă limba UI-ului și o persistă local.
export function setUiLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignorăm — schimbarea rămâne măcar pe sesiunea curentă
  }
  i18n.changeLanguage(lang);
}

export default i18n;
