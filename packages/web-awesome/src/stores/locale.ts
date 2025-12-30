import { formatDuration } from "@allurereport/core-api";
import { DEFAULT_LOCALE, LANG_LOCALE, type LangLocale, getReportOptions } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import i18next, { type TOptions } from "i18next";
import type { AwesomeReportOptions } from "types";

const namespaces = [
  "empty",
  "execution",
  "filters",
  "filters.description",
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
  "split",
  "modal",
  "environments",
  "charts",
  "sections",
  "timeline",
  "transitions",
] as const;

export const currentLocale = signal<LangLocale>("en" as LangLocale);
export const currentLocaleIso = computed(() => LANG_LOCALE[currentLocale.value]?.iso ?? LANG_LOCALE.en.iso);
export const currentLocaleIsRTL = computed(() => ["ar", "he", "fa"].includes(currentLocale.value));

export const getLocale = async () => {
  const { reportLanguage } = getReportOptions<AwesomeReportOptions>() ?? {};
  const locale = localStorage.getItem("currentLocale") || reportLanguage || DEFAULT_LOCALE;

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
      await import(`@/locales/${language}.json`)
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
    i18next.services.formatter.add("capitalize", (value) => {
      return value.charAt(0).toLocaleUpperCase() + value.slice(1);
    });
    i18next.services.formatter.add("timestamp_date", (value: number, lng, options) => {
      const formatter = new Intl.DateTimeFormat(lng, {
        ...options,
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
      return formatter.format(value);
    });
    i18next.services.formatter.add("timestamp_long", (value: number, lng, options) => {
      const formatter = new Intl.DateTimeFormat(lng, {
        ...options,
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
      });
      return formatter.format(value).replace(",", ` ${i18next.t("ui:at")}`);
    });
    i18next.services.formatter.add("timestamp_long_no_seconds", (value: number, lng, options) => {
      const formatter = new Intl.DateTimeFormat(lng, {
        ...options,
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      return formatter.format(value).replace(",", ` ${i18next.t("ui:at")}`);
    });
    i18next.services.formatter.add("format_duration", (value: number) => {
      return formatDuration(value);
    });
  });

export const useI18n = (namespace: (typeof namespaces)[number]) => {
  const t = computed(
    () =>
      (key: string, options: TOptions = {}) =>
        i18next.t(key, { ns: namespace, ...options }),
  );

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
