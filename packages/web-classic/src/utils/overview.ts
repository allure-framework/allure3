import { ChartType } from "@allurereport/charts-api";
import type { Statistic } from "@allurereport/core-api";
import { byStatistic, compareBy } from "@allurereport/core-api";
import type { UIChartsData } from "@allurereport/web-commons";
import type { ReportTree } from "types";

export type TreeWidgetItem = {
  id: string;
  name: string;
  statistic: Statistic;
};

export type TreeWidgetData = {
  items: TreeWidgetItem[];
  total: number;
};

export const TREE_WIDGET_LIMIT = 10;

/**
 * Builds the data of an Overview widget (suites, features, categories) from the top level groups of a tree,
 * the groups with the most failed and broken tests go first, as in Allure 2;
 * the total counts all top level nodes: the groups and the tests outside of any group
 */
export const createTreeWidgetData = (tree?: ReportTree, limit: number = TREE_WIDGET_LIMIT): TreeWidgetData => {
  const groupIds = tree?.root?.groups ?? [];
  const items = groupIds
    .map((id): TreeWidgetItem | undefined => {
      const group = tree?.groupsById?.[id];

      if (!group) {
        return undefined;
      }

      return {
        id,
        name: group.name,
        statistic: group.statistic ?? { total: 0 },
      };
    })
    .filter((item): item is TreeWidgetItem => item !== undefined)
    .sort(compareBy<TreeWidgetItem, "statistic">("statistic", byStatistic()));

  // as in Allure 2, the total counts every top level node, the tests outside of any group too
  return {
    items: items.slice(0, limit),
    total: items.length + (tree?.root?.leaves?.length ?? 0),
  };
};

/**
 * Picks the status trend of the report from the generated charts
 */
export const findTrendChart = (charts?: UIChartsData) =>
  Object.values(charts ?? {}).find((chart) => chart?.type === ChartType.StatusDynamics);
