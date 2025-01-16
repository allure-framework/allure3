import { getReportOptions } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import i18next, { type TOptions } from "i18next";
import { DEFAULT_LOCALE, LANG_LOCALE, type LangLocale } from "@/i18n/constants";
import type { AllureAwesomeReportOptions } from "../../types.js";

const { reportLanguage } = getReportOptions<AllureAwesomeReportOptions>() ?? {};

const namespaces = [
  "empty",
  "execution",
  "filters",
  "search",
  "severity",
  "sort-by",
  "sort-by.directions",
  "sort-by.values",
  "statuses",
  "tabs",
  "testSummary",
  "ui",
  "welcome",
  "controls",
  "errors",
];

export const currentLocale = signal<LangLocale>("en" as LangLocale);

export const currentLocaleIso = computed(() => {
  const locale = currentLocale.value;

  return LANG_LOCALE[locale].iso;
});

export const currentLocaleIsRTL = computed(() => {
  return ["ar", "he", "fa"].includes(currentLocale.value as string);
});

export const getLocale = () => {
  const locale = localStorage.getItem("currentLocale") || reportLanguage || DEFAULT_LOCALE;
  setLocale(locale as LangLocale);
};

i18next
  .use({
    type: "backend",
    async read(language: LangLocale, namespace: string, callback: (errorValue: unknown, translations: null) => void) {
      await import(`@/i18n/locales/${language}.json`)
        .then((resources) => {
          callback(null, resources[namespace]);
        })
        .catch((error) => {
          callback(error, null);
        });
    },
  })
  .init({
    lng: currentLocale.value,
    fallbackLng: "en",
    ns: namespaces,
    interpolation: {
      escapeValue: false,
    },
  });

export const useI18n = (namespace?: string) => {
  const t = computed(() => (key: string, options?: TOptions) => i18next.t(key, { ns: namespace, ...options }));

  return {
    t: t.value,
    currentLocale: currentLocale.value,
  };
};

export const setLocale = async (locale: LangLocale) => {
  await i18next.changeLanguage(locale);
  localStorage.setItem("currentLocale", locale);
  currentLocale.value = locale;
};
