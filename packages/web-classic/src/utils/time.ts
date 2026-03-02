import { getLocaleDateTimeOverride } from "@allurereport/web-commons";
import { currentLocale, currentLocaleIso, useI18n } from "@/stores/locale";

const defaultOptions: Intl.DateTimeFormatOptions = {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
};

/** Returns true if the value is a valid timestamp (ms) that Date can format. */
const isValidTimestamp = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v < 8640000000000000;

export const timestampToDate = (timestamp: number, options = defaultOptions): string => {
  if (!isValidTimestamp(timestamp)) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t } = useI18n("ui");
  const kind = options.second ? "dateTime" : options.hour || options.minute ? "dateTimeNoSeconds" : "date";
  const override = getLocaleDateTimeOverride(currentLocale.value, kind);
  const formatter = new Intl.DateTimeFormat(override?.locale ?? (currentLocaleIso.value as string), {
    ...options,
    ...(override?.options ?? {}),
  });
  const formatted = formatter.format(date);

  if (override?.includeAtSeparator === false || override?.stripComma) {
    return formatted.replace(",", "");
  }

  return formatted.replace(",", ` ${t("at")}`);
};
