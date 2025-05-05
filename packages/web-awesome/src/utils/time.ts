import { useI18n } from "@/stores/locale";

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
  const { t } = useI18n("ui");

  return new Intl.DateTimeFormat("en-US", options).format(date).replace(",", ` ${t("at")}`);
};
