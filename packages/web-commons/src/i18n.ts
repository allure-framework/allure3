export const AVAILABLE_LOCALES = [
  "en",
  "en-iso",
  "ru",
  "uk",
  "pl",
  "es",
  "pt",
  "de",
  "hy",
  "az",
  "fr",
  "it",
  "ja",
  "he",
  "ka",
  "kr",
  "nl",
  "sv",
  "tr",
  "zh",
] as const;

export const DEFAULT_LOCALE = "en";

export type LangLocale = (typeof AVAILABLE_LOCALES)[number];

export type DateTimeFormatKind = "date" | "dateTime" | "dateTimeNoSeconds";

export type DateTimeFormatOverride = {
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
  includeAtSeparator?: boolean;
  stripComma?: boolean;
};

export const LOCALE_DATE_TIME_OVERRIDES: Record<string, Partial<Record<DateTimeFormatKind, DateTimeFormatOverride>>> = {
  "en-iso": {
    date: {
      locale: "en-CA",
      options: {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
      stripComma: true,
    },
    dateTime: {
      locale: "en-CA",
      options: {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      },
      includeAtSeparator: false,
      stripComma: true,
    },
    dateTimeNoSeconds: {
      locale: "en-CA",
      options: {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
      includeAtSeparator: false,
      stripComma: true,
    },
  },
};

export const getLocaleDateTimeOverride = (locale: string, kind: DateTimeFormatKind) => {
  return LOCALE_DATE_TIME_OVERRIDES[locale]?.[kind];
};

export const LANG_LOCALE: Record<
  LangLocale,
  {
    short: string;
    full: string;
    iso: string;
  }
> = {
  "en": {
    short: "Eng",
    full: "English",
    iso: "en-US",
  },
  "en-iso": {
    short: "En ISO",
    full: "English (ISO-8601)",
    iso: "en-CA",
  },
  "ru": {
    short: "Ру",
    full: "Русский",
    iso: "ru-RU",
  },
  "uk": {
    short: "Ук",
    full: "Українська",
    iso: "uk-UA",
  },
  "pl": {
    short: "Pl",
    full: "Polski",
    iso: "pl-PL",
  },
  "es": {
    short: "Es",
    full: "Español",
    iso: "es-ES",
  },
  "pt": {
    short: "Pt",
    full: "Português",
    iso: "pt-PT",
  },
  "de": {
    short: "De",
    full: "Deutsch",
    iso: "de-DE",
  },
  "hy": {
    short: "Hy",
    full: "Հայերեն",
    iso: "hy-AM",
  },
  "az": {
    short: "Az",
    full: "Azərbaycan",
    iso: "az-AZ",
  },
  "fr": {
    short: "Fr",
    full: "Français",
    iso: "fr-FR",
  },
  "it": {
    short: "It",
    full: "Italiano",
    iso: "it-IT",
  },
  "ja": {
    short: "Ja",
    full: "日本語",
    iso: "ja-JP",
  },
  "he": {
    short: "He",
    full: "עברית",
    iso: "he-IL",
  },
  "ka": {
    short: "Ka",
    full: "ქართული",
    iso: "ka-GE",
  },
  "kr": {
    short: "Kr",
    full: "한국어",
    iso: "kr-KR",
  },
  "nl": {
    short: "Nl",
    full: "Nederlands",
    iso: "nl-NL",
  },
  "sv": {
    short: "Sv",
    full: "Svenska",
    iso: "sv-SE",
  },
  "tr": {
    short: "Tr",
    full: "Türkçe",
    iso: "tr-TR",
  },
  "zh": {
    short: "Zh",
    full: "中文",
    iso: "zh-CN",
  },
};
