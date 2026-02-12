import { getLocaleDateTimeOverride } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import i18next, { type TOptions } from "i18next";
import { DEFAULT_LOCALE, LANG_LOCALE, type LangLocale } from "@/i18n/constants";

const namespaces = ["empty", "summary", "ui"];

export const currentLocale = signal<LangLocale>("en" as LangLocale);
export const currentLocaleIso = computed(() => LANG_LOCALE[currentLocale.value]?.iso ?? LANG_LOCALE.en.iso);
export const currentLocaleIsRTL = computed(() => ["ar", "he", "fa"].includes(currentLocale.value as string));

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
      const loadLocale = language === "en-iso" ? "en" : language;
      await import(`@/i18n/locales/${loadLocale}.json`)
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
  })
  .then(() => {
    i18next.services.formatter!.add("timestamp_long_no_seconds", (value: number, lng) => {
      const override = getLocaleDateTimeOverride(lng as string, "dateTime");
      const resolvedLocale = override?.locale ?? lng;
      const dateFormatter = new Intl.DateTimeFormat(resolvedLocale, {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
      const timeFormatter = new Intl.DateTimeFormat(resolvedLocale, {
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const datePart = dateFormatter.format(value);
      const timePart = timeFormatter.format(value);
      const separator = i18next.t("ui:at", { lng });
      return `${datePart} ${separator} ${timePart}`;
    });
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
