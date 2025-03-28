import { computed, signal } from "@preact/signals";
import i18next, { type TOptions } from "i18next";
import { DEFAULT_LOCALE, LANG_LOCALE, type LangLocale } from "@/i18n/constants";

const namespaces = ["empty", "summary"];

export const currentLocale = signal<LangLocale>("en" as LangLocale);
export const currentLocaleIso = computed(() => LANG_LOCALE[currentLocale.value]?.iso ?? LANG_LOCALE.en.iso);
export const currentLocaleIsRTL = computed(() => ["ar", "he", "fa"].includes(currentLocale.value));

export const getLocale = async () => {
  const locale = localStorage.getItem("currentLocale") || DEFAULT_LOCALE;

  await setLocale(locale as LangLocale);
};

export const waitForI18next = i18next
  .use({
    type: "backend",
    read: async (
      language: LangLocale,
      namespace: string,
      callback: (errorValue: unknown, translations: null) => void,
    ) => {
      await import(`@/i18n/locales/${language}.json`)
        .then((resources: Record<string, null>) => {
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
    interpolation: { escapeValue: false },
  });

export const useI18n = (namespace?: string) => {
  const t = computed(() => (key: string, options?: TOptions) => i18next.t(key, { ns: namespace, ...options }));

  return {
    t: t.value,
    currentLocale: currentLocale.value,
  };
};

export const setLocale = async (locale: LangLocale) => {
  await i18next.changeLanguage(locale as string);
  localStorage.setItem("currentLocale", locale as string);
  currentLocale.value = locale;
};
