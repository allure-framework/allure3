import type {
  AllureChartsStoreData,
  TreeMapChartData,
  TreeMapChartOptions,
  TreeMapDataAccessor,
  TreeMapNode,
} from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";

import { coverageDiffTreeMapAccessor } from "./accessors/coverageDiffTreeMapAccessor.js";
import { successRateDistributionTreeMapAccessor } from "./accessors/successRateDistributionTreeMapAccessor.js";

export { convertTreeDataToTreeMapNode, transformTreeMapNode } from "./treeMapUtils.js";

export const generateTreeMapChartGeneric = <T extends TreeMapNode>(
  options: TreeMapChartOptions,
  storeData: AllureChartsStoreData,
  dataAccessor: TreeMapDataAccessor<T>,
): TreeMapChartData | undefined => ({
  type: options.type,
  title: options.title,
  treeMap: dataAccessor.getTreeMap(storeData),
});

export const generateTreeMapChart = (
  options: TreeMapChartOptions,
  storeData: AllureChartsStoreData,
): TreeMapChartData | undefined => {
  const { type } = options;

  if (type === ChartType.SuccessRateDistribution) {
    return generateTreeMapChartGeneric(options, storeData, successRateDistributionTreeMapAccessor);
  } else if (type === ChartType.CoverageDiff) {
    return generateTreeMapChartGeneric(options, storeData, coverageDiffTreeMapAccessor);
  }
};
