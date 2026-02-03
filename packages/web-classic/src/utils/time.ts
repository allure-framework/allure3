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

export const timestampToDate = (timestamp: number, options = defaultOptions) => {
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

  return formatted.replace(",", ` ${t("at")}`);
};
