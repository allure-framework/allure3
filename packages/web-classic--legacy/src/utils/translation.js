import i18next from "i18next";
import gtag from "./gtag.js";
import settings from "./settings.js";

export const LANGUAGES = [
  { id: "az", title: "Azərbaycanca" },
  { id: "br", title: "Brazil" },
  { id: "de", title: "Deutsch" },
  { id: "en", title: "English" },
  { id: "es", title: "Español" },
  { id: "fr", title: "Français" },
  { id: "he", title: "Hebrew" },
  { id: "isv", abbr: "Ⱄ", title: "Medžuslovjansky" },
  { id: "ja", title: "日本語" },
  { id: "kr", title: "한국어" },
  { id: "nl", title: "Nederlands" },
  { id: "pl", title: "Polski" },
  { id: "ru", title: "Русский" },
  { id: "sv", title: "Svenska" },
  { id: "tr", title: "Türkçe" },
  { id: "zh", title: "中文" },
];

export function initTranslations() {
  return new Promise(async (resolve, reject) => {
    await Promise.all(
      LANGUAGES.map((lang) => lang.id).map(async (lang) => {
        const locale = await import(`../translations/${lang}.json`);

        addTranslation(lang, JSON.parse(locale.default));
      }),
    );

    const language = settings.getLanguage() || "en";

    i18next.init(
      {
        lng: language,
        interpolation: {
          escapeValue: false,
        },
        fallbackLng: "en",
      },
      (err) => (err ? reject(err) : resolve()),
    );

    i18next.on("initialized", () => {
      const pluralResolver = i18next.services.pluralResolver;

      pluralResolver.addRule("isv", pluralResolver.getRule("be"));
    });

    gtag("init_language", { language });
  });
}

export function addTranslation(lang, json) {
  i18next.on("initialized", () => {
    i18next.services.resourceStore.addResourceBundle(lang, i18next.options.ns[0], json, true, true);
  });
}

export default i18next;
