import type { BarDatum } from "@nivo/bar";
import { toNumber } from "lodash";

export const computeVerticalAxisMargin = <T extends BarDatum>({
  data,
  keys,
  stacked,
  position,
  format,
}: {
  data: T[];
  keys: string[];
  stacked: boolean;
  position: "left" | "right";
  format: (value: number | string) => string | number;
}) => {
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
  const digits = format(maxValue).toString().length + 1;

  const padding = position === "left" ? 8 : -8;
  const digitWidth = 8;
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
