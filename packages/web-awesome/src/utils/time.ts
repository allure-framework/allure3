import { getLocaleDateTimeOverride } from "@allurereport/web-commons";

import { currentLocale, currentLocaleIso, useI18n } from "@/stores/locale";
import { ensureAtSeparator } from "@/utils/atSeparator";

export const defaultDateTimeOptions: Intl.DateTimeFormatOptions = {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
};

export const timestampToDate = (timestamp: number, options = defaultDateTimeOptions) => {
  const date = new Date(timestamp);
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

  return ensureAtSeparator(formatted, t("at"));
};

/**
 * Same as `defaultDateTimeOptions`, but with millisecond precision.
 * Needed to correlate durations with logs and to tell apart parallel steps that start within the same second.
 */
export const preciseDateTimeOptions: Intl.DateTimeFormatOptions = {
  ...defaultDateTimeOptions,
  fractionalSecondDigits: 3,
};

/**
 * Formats the interval a duration was calculated from: one labelled timestamp per line (tooltips keep
 * line breaks), ordered by time, so an interval whose stop is earlier than its start (clock skew between
 * machines) still reads chronologically and every label stays with its own timestamp.
 * Falls back to the single known timestamp, and returns `undefined` when neither is known.
 */
export const formatTimeRange = (start?: number, stop?: number): string | undefined => {
  const timestamps: Array<[string, number]> = [];

  if (typeof start === "number") {
    timestamps.push(["start", start]);
  }

  if (typeof stop === "number") {
    timestamps.push(["stop", stop]);
  }

  if (!timestamps.length) {
    return undefined;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t } = useI18n("ui");

  return timestamps
    .sort(([, left], [, right]) => left - right)
    .map(([key, value]) => `${t(key)}: ${timestampToDate(value, preciseDateTimeOptions)}`)
    .join("\n");
};
