export const AVAILABLE_LOCALES = [
  "en",
  "ru",
  "pl",
  "es",
  "pt",
  "de",
  "am",
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

export const LANG_LOCALE: Record<
  LangLocale,
  {
    short: string;
    full: string;
    iso: string;
  }
> = {
  en: {
    short: "Eng",
    full: "English",
    iso: "en-US",
  },
  ru: {
    short: "Ру",
    full: "Русский",
    iso: "ru-RU",
  },
  pl: {
    short: "Pl",
    full: "Polski",
    iso: "pl-PL",
  },
  es: {
    short: "Es",
    full: "Español",
    iso: "es-ES",
  },
  pt: {
    short: "Pt",
    full: "Português",
    iso: "pt-PT",
  },
  de: {
    short: "De",
    full: "Deutsch",
    iso: "de-DE",
  },
  am: {
    short: "Am",
    full: "Հայերեն",
    iso: "hy-AM",
  },
  az: {
    short: "Az",
    full: "Azərbaycan",
    iso: "az-AZ",
  },
  fr: {
    short: "Fr",
    full: "Français",
    iso: "fr-FR",
  },
  it: {
    short: "It",
    full: "Italiano",
    iso: "it-IT",
  },
  ja: {
    short: "Ja",
    full: "日本語",
    iso: "ja-JP",
  },
  he: {
    short: "He",
    full: "עברית",
    iso: "he-IL",
  },
  ka: {
    short: "Ka",
    full: "ქართული",
    iso: "ka-GE",
  },
  kr: {
    short: "Kr",
    full: "한국어",
    iso: "kr-KR",
  },
  nl: {
    short: "Nl",
    full: "Nederlands",
    iso: "nl-NL",
  },
  sv: {
    short: "Sv",
    full: "Svenska",
    iso: "sv-SE",
  },
  tr: {
    short: "Tr",
    full: "Türkçe",
    iso: "tr-TR",
  },
  zh: {
    short: "Zh",
    full: "中文",
    iso: "zh-CN",
  },
};
