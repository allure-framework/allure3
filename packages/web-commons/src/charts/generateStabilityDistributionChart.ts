import type {
  AllureChartsStoreData,
  StabilityDistributionChartData,
  StabilityDistributionChartOptions,
} from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import { createHistoryTestResultLookup, getTestFlakiness, type TestStatus } from "@allurereport/core-api";

import { createHashStorage } from "./utils.js";

const DEFAULT_THRESHOLD = 90;
const DEFAULT_GROUP_BY = "feature";
const CUSTOM_LABEL_NAME_PREFIX = "label-name:";
const SIGNIFICANT_STATUSES = new Set<TestStatus>(["passed", "failed", "broken"]);
const NON_SIGNIFICANT_STATUSES: TestStatus[] = ["unknown", "skipped"];

export const generateStabilityDistributionChart = (props: {
  options: StabilityDistributionChartOptions;
  storeData: AllureChartsStoreData;
}): StabilityDistributionChartData => {
  const { options, storeData } = props;
  const {
    title,
    limit,
    stabilizationPeriod,
    threshold = DEFAULT_THRESHOLD,
    skipStatuses: skipStatusesList = NON_SIGNIFICANT_STATUSES,
    groupBy = DEFAULT_GROUP_BY,
    groupValues = [],
  } = options;

  const chart: StabilityDistributionChartData = {
    data: [],
    keys: {},
    type: ChartType.StabilityDistribution,
    title,
    threshold,
  };
  if (limit === 0) {
    return chart;
  }

  const { testResults, historyDataPoints } = storeData;
  const lookup = createHistoryTestResultLookup(storeData.allTestResults ?? testResults);
  const history = [...historyDataPoints].sort((a, b) => b.timestamp - a.timestamp);
  const labelName = groupBy.startsWith(CUSTOM_LABEL_NAME_PREFIX)
    ? groupBy.slice(CUSTOM_LABEL_NAME_PREFIX.length)
    : groupBy;
  const groupValuesSet = new Set(groupValues ?? []);
  const groups = new Map<string, { stable: number; assessed: number }>();
  const hashes = createHashStorage();
  const skipStatuses = new Set(skipStatusesList);

  for (const tr of testResults) {
    if (!SIGNIFICANT_STATUSES.has(tr.status) || skipStatuses.has(tr.status)) {
      continue;
    }
    const labelValue = tr.labels?.find((label) => label.name === labelName)?.value;
    if (!labelValue || (groupValuesSet.size > 0 && !groupValuesSet.has(labelValue))) {
      continue;
    }

    const flaky =
      tr.sourceMetadata?.reportedFlaky === true
        ? true
        : getTestFlakiness(
            tr,
            history.map((point) => lookup(point, tr)),
            { historyDepth: limit, stabilizationPeriod },
          );
    if (flaky === undefined) {
      continue;
    }

    const id = hashes.get(labelValue);
    let counts = groups.get(id);
    if (!counts) {
      counts = { stable: 0, assessed: 0 };
      groups.set(id, counts);
      chart.keys[id] = labelValue;
    }
    counts.assessed++;
    if (!flaky) {
      counts.stable++;
    }
  }

  chart.data = [...groups].map(([id, counts]) => ({
    id,
    stabilityRate: Math.floor((counts.stable * 10000) / counts.assessed) / 100,
  }));
  return chart;
};
