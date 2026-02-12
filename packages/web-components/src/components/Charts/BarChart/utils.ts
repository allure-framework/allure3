import type { BarDatum } from "@nivo/bar";
import { toNumber } from "lodash";

export const computeVerticalAxisMargin = <T extends BarDatum>({
  data,
  layout = "vertical",
  indexBy,
  keys,
  stacked,
  position,
  formatLeftTick,
  formatBottomTick,
}: {
  data: T[];
  indexBy: Extract<keyof T, string>;
  layout: "horizontal" | "vertical";
  keys: string[];
  stacked: boolean;
  position: "left" | "right";
  formatLeftTick: (value: number | string) => string | number;
  formatBottomTick: (value: number | string, item: T) => string | number;
}) => {
  const digitWidth = 8;
  const padding = position === "left" ? 8 : -8;
  if (layout === "horizontal") {
    const charWidth = 6;
    const translatedKeys = data.map((item) => formatBottomTick(item[indexBy], item).toString().length);
    const charCount = Math.max(...translatedKeys);
    return charCount * charWidth + padding;
  }

  const maxValue = Math.floor(
    Math.max(
      ...data.map((item) => {
        if (stacked) {
          return keys.map((key) => toNumber(item[key] ?? 0)).reduce((acc, v) => acc + v, 0);
        }

        return Math.max(...keys.map((key) => toNumber(item[key] ?? 0)));
      }),
    ),
  );

  // Add 1 for when axis has max value
  const digits = formatLeftTick(maxValue).toString().length + 1;

  const thousands = Math.max(Math.floor((digits - 1) / 3), 0);
  const thousandsWidth = 10;
  const reserved = 1;

  return padding + digits * digitWidth + thousands * thousandsWidth + reserved;
};

export const isEmptyChart = <T extends BarDatum>(data: T[], indexBy: Extract<keyof T, string>) => {
  return data.every((item) =>
    Object.keys(item)
      .filter((key) => key !== indexBy)
      .every((key) => item[key] === 0),
  );
};
