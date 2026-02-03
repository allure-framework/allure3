import { formatDuration } from "@allurereport/core-api";
import {
  DEFAULT_LOCALE,
  LANG_LOCALE,
  type LangLocale,
  getLocaleDateTimeOverride,
  getReportOptions,
} from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import i18next, { type TOptions } from "i18next";
import type { DashboardReportOptions } from "types";

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
  "split",
  "modal",
  "charts",
  "transitions",
];

export const currentLocale = signal<LangLocale>("en" as LangLocale);
export const currentLocaleIso = computed(() => LANG_LOCALE[currentLocale.value]?.iso ?? LANG_LOCALE.en.iso);
export const currentLocaleIsRTL = computed(() => ["ar", "he", "fa"].includes(currentLocale.value));

export const getLocale = async () => {
  const { reportLanguage } = getReportOptions<DashboardReportOptions>() ?? {};
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
      const loadLocale = language === "en-iso" ? "en" : language;
      await import(`@/locales/${loadLocale}.json`)
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
    i18next.services.formatter.add("capitalize", (value: string) => {
      return value.charAt(0).toLocaleUpperCase() + value.slice(1);
    });
    i18next.services.formatter.add(
      "timestamp_date",
      (value: number, lng: string, options?: Intl.DateTimeFormatOptions) => {
        const override = getLocaleDateTimeOverride(lng, "date");
        const formatter = new Intl.DateTimeFormat(override?.locale ?? lng, {
          ...options,
          month: "numeric",
          day: "numeric",
          year: "numeric",
          ...(override?.options ?? {}),
        });
        const formatted = formatter.format(value);
        return override?.stripComma ? formatted.replace(",", "") : formatted;
      },
    );
    i18next.services.formatter.add(
      "timestamp_long",
      (value: number, lng: string, options?: Intl.DateTimeFormatOptions) => {
        const override = getLocaleDateTimeOverride(lng, "dateTime");
        const formatter = new Intl.DateTimeFormat(override?.locale ?? lng, {
          ...options,
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: false,
          ...(override?.options ?? {}),
        });
        const formatted = formatter.format(value);
        if (override?.includeAtSeparator === false || override?.stripComma) {
          return formatted.replace(",", "");
        }
        return formatted.replace(",", ` ${i18next.t("ui:at")}`);
      },
    );
    i18next.services.formatter.add(
      "timestamp_long_no_seconds",
      (value: number, lng: string, options?: Intl.DateTimeFormatOptions) => {
        const override = getLocaleDateTimeOverride(lng, "dateTimeNoSeconds");
        const formatter = new Intl.DateTimeFormat(override?.locale ?? lng, {
          ...options,
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: false,
          ...(override?.options ?? {}),
        });
        const formatted = formatter.format(value);
        if (override?.includeAtSeparator === false || override?.stripComma) {
          return formatted.replace(",", "");
        }
        return formatted.replace(",", ` ${i18next.t("ui:at")}`);
      },
    );
    i18next.services.formatter.add("format_duration", (value: number) => {
      return formatDuration(value);
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
