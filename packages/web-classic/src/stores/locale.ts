import { getReportOptions } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import i18next, { type TOptions } from "i18next";
import { DEFAULT_LOCALE, LANG_LOCALE, type LangLocale } from "@/translations/constants";
import type { AwesomeReportOptions } from "../../types.js";

const { reportLanguage } = getReportOptions<AwesomeReportOptions>() ?? {};

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
  "nav",
  "charts",
];

export const currentLocale = signal<LangLocale>("" as LangLocale);

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
    read: async (
      language: LangLocale,
      namespace: string,
      callback: (errorValue: unknown, translations: Record<string, string> | null) => void,
    ) => {
      try {
        const resources = await import(`@/translations/${language}.json`);
        callback(null, (resources[namespace] as Record<string, string>) || null);
      } catch (error) {
        callback(error, null);
      }
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
