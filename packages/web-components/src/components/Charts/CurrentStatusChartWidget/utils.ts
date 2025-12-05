import { type Statistic, type TestStatus, statusesList } from "@allurereport/core-api";
import { getColorFromStatus } from "../utils";
import type { ChartData, I18nProp } from "./types";

const UNITS = [
  { limit: 1e3, suffix: "K" },
  { limit: 1e6, suffix: "M" },
  { limit: 1e9, suffix: "B" },
  { limit: 1e12, suffix: "T" },
  { limit: 1e15, suffix: "Q" },
];

export const getPercentOf = (value = 0, total = 0) => {
  // Return 0 if value is zero since percentage calculation would result in 0
  if (value === 0) {
    return "0";
  }

  // Return 0 if total is zero to avoid division by zero
  if (total === 0) {
    return "0";
  }

  const percentage = (value / total) * 100;

  // Return as integer string if there's no decimal part
  if (Number.isInteger(percentage)) {
    return percentage.toString();
  }

  // Protect against floating-point representation slightly above 99.99 but less than 100
  if (percentage > 99.99 && percentage < 100) {
    return "99.99";
  }

  // Remove trailing zeros by converting to string without redundant zeros after decimal
  return percentage.toFixed(2).replace(/\.?0+$/, "");
};

export const formatPercentageToFitWidth = ({
  width,
  text,
  symbolWidth,
}: {
  width: number;
  text: string;
  symbolWidth: number;
}) => {
  const availableWidth = width - 2 * symbolWidth;

  const textWidth = text.length * symbolWidth;

  const [textValue] = text.split("%");
  const [nominator, denominator = "00"] = textValue.split(".");

  if (denominator === "00") {
    return `${nominator}%`;
  }

  if (availableWidth > textWidth) {
    return text;
  }

  const nominatorWidth = nominator.length * symbolWidth;
  const pointWidth = symbolWidth;

  const denominatorCount = Math.floor((availableWidth - nominatorWidth - pointWidth) / symbolWidth) - 1;

  if (denominatorCount === 1) {
    const singleDenominatorValue = (+`${nominator}.${denominator}`).toFixed(1);
    const [roundValueNominator, roundValueDenominator] = singleDenominatorValue.toString().split(".");

    if (roundValueDenominator === "0") {
      return `${roundValueNominator}%`;
    }

    return `${singleDenominatorValue}%`;
  }

  if (denominatorCount === 2) {
    return `${nominator}.${denominator}%`;
  }

  const value = +`${nominator}.${denominator}`;
  const roundedValue = value.toFixed(0);

  return `${roundedValue}%`;
};

export const formatTotalToFitWidth = ({
  width,
  text,
  symbolWidth,
}: {
  width: number;
  text: string;
  symbolWidth: number;
}) => {
  const availableWidth = width - 2 * symbolWidth;

  const maxSymbols = Math.floor(availableWidth / symbolWidth);

  const value = parseInt(text, 10);

  const formattedWithSpaces = value.toLocaleString("ru");

  if (formattedWithSpaces.length <= maxSymbols) {
    return formattedWithSpaces;
  }

  let shortValue = value;
  let finalSuffix = "";

  for (let i = 0; i < UNITS.length; i++) {
    const { limit, suffix } = UNITS[i];

    shortValue = value / limit;

    // If value less than 1000 or it is the last suffix - use current
    if (Math.round(shortValue) < 1000 || i === UNITS.length - 1) {
      finalSuffix = suffix;
      break;
    }
  }

  const roundedValue = shortValue.toFixed(2);

  let cleanedValue = roundedValue
    .replace(/\.?0+$/, "") // remove ".00" or ".0"
    .replace(/(\.\d)0$/, "$1"); // remove the last 0

  if ((cleanedValue + finalSuffix).length > maxSymbols) {
    cleanedValue = Math.round(+cleanedValue).toString();
  }

  const formattedCleanedValue = +cleanedValue;

  return `${formattedCleanedValue.toLocaleString("ru")}${finalSuffix}`;
};

export const formatDescriptionToFitWidth = ({
  width,
  text,
  symbolWidth,
}: {
  width: number;
  text: string;
  symbolWidth: number;
}) => {
  const numbers = text.match(/\d+/g) || [];
  const nonNumbersLength = text.replace(/\d+/g, "").length;

  const formattedNumbers = numbers.map((num) => {
    return formatTotalToFitWidth({
      width: width - nonNumbersLength * symbolWidth,
      text: num,
      symbolWidth,
    });
  });

  let result = text;
  numbers.forEach((num, i) => {
    result = result.replace(num, formattedNumbers[i]);
  });

  return result;
};

export const toChartData = (props: { data: Statistic; i18n: I18nProp; statuses?: TestStatus[] }): ChartData => {
  const { data, i18n, statuses = statusesList } = props;
  const chartData: ChartData = [];

  for (const status of statuses) {
    if (status in data) {
      chartData.push({
        color: getColorFromStatus(status),
        id: status,
        value: data[status] ?? 0,
        label: i18n(`status.${status}`),
      });
    }
  }

  return chartData;
};
