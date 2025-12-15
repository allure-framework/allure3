import type {
  AllureChartsStoreData,
  BarChartData,
  BarChartOptions,
  BarDataAccessor,
  BarGroupValues,
} from "@allurereport/charts-api";
import { BarChartType, ChartMode, DEFAULT_CHART_HISTORY_LIMIT } from "@allurereport/charts-api";
import { statusBySeverityBarDataAccessor } from "./accessors/statusBySeverityBarAccessor.js";
import { generateBarChartFbsuAgePyramid } from "./bar/generateBarChartFbsuAgePyramid.js";
import { limitHistoryDataPoints } from "./chart-utils.js";

export const generateBarChartGeneric = <P extends string, T extends string>(
  options: BarChartOptions,
  storeData: AllureChartsStoreData,
  dataAccessor: BarDataAccessor<P, T>,
): BarChartData | undefined => {
  const { type, dataType, title, limit = DEFAULT_CHART_HISTORY_LIMIT, mode = ChartMode.Raw } = options;

  // Apply limit to history points if specified
  const { historyDataPoints } = storeData;
  const limitedHistoryPoints = limitHistoryDataPoints(historyDataPoints, limit);
  const isFullHistory = limitedHistoryPoints.length === historyDataPoints.length;

  const items = dataAccessor.getItems(storeData, limitedHistoryPoints, isFullHistory);

  // Apply mode transformation if needed
  let processedData = items;
  if (mode === ChartMode.Percent) {
    processedData = items.map((group) => {
      const { groupId, ...values } = group;

      const total = Object.values<number>(values).reduce((sum, value) => sum + value, 0);
      const nextValues = Object.keys(values).reduce((acc, valueKey) => {
        acc[valueKey as T] = (values as BarGroupValues)[valueKey as T] / total;

        return acc;
      }, {} as BarGroupValues<T>);

      return {
        groupId,
        ...nextValues,
      };
    });
  }

  return {
    type,
    dataType,
    mode,
    title,
    data: processedData,
    keys: dataAccessor.getGroupKeys(),
    groupMode: dataAccessor.getGroupMode(),
    indexBy: "groupId",
  };
};

export const generateBarChart = (
  options: BarChartOptions,
  storeData: AllureChartsStoreData,
): BarChartData | undefined => {
  const newOptions = { limit: DEFAULT_CHART_HISTORY_LIMIT, ...options };
  const { dataType } = newOptions;

  switch (dataType) {
    case BarChartType.StatusBySeverity:
      return generateBarChartGeneric(newOptions, storeData, statusBySeverityBarDataAccessor);
    case BarChartType.FbsuAgePyramid:
      return generateBarChartFbsuAgePyramid(newOptions, storeData);
  }
};
