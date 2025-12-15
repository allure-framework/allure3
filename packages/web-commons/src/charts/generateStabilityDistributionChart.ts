import type {
  AllureChartsStoreData,
  StabilityDistributionChartData,
  StabilityDistributionChartOptions,
} from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import type { TestResult, TestStatus } from "@allurereport/core-api";
import { createHashStorage, createMapWithDefault } from "./utils.js";

const MAX_POINTS = 20;
const DEFAULT_THRESHOLD = 90;
const DEFAULT_GROUP_BY = "feature";
const CUSTOM_LABEL_NAME_PREFIX = "label-name:";

const getTrLabelValue = (testResult: TestResult, labelName: string) => {
  return testResult.labels.find((label) => label.name === labelName)?.value;
};

const getStabilityRate = (passed: number, total: number) => {
  return Math.floor((passed / total) * 10000) / 100;
};

const NON_SIGNIFICANT_STATUSES: TestStatus[] = ["unknown", "skipped"];

class IncludeAllArray<T> extends Array<T> {
  constructor() {
    super();
  }
  includes() {
    return true;
  }
}

const allValuesList = new IncludeAllArray<string>();

export const generateStabilityDistributionChart = (props: {
  options: StabilityDistributionChartOptions;
  storeData: AllureChartsStoreData;
}): StabilityDistributionChartData => {
  const { options, storeData } = props;
  const {
    title,
    threshold = DEFAULT_THRESHOLD,
    skipStatuses = NON_SIGNIFICANT_STATUSES,
    groupBy = DEFAULT_GROUP_BY,
    groupValues = [],
  } = options;
  const { testResults } = storeData;

  const labelName = groupBy.startsWith(CUSTOM_LABEL_NAME_PREFIX)
    ? groupBy.slice(CUSTOM_LABEL_NAME_PREFIX.length)
    : groupBy;

  const labelValuesList = groupValues.length > 0 ? groupValues : allValuesList;

  const trsStatsByLabelValues = createMapWithDefault<string, { passed: number; total: number }>({
    passed: 0,
    total: 0,
  });
  const keys: Record<string, string> = {};
  const hashes = createHashStorage();

  for (const tr of testResults) {
    const labelValue = getTrLabelValue(tr, labelName);

    // If test result has no label value, skip it
    if (!labelValue) {
      continue;
    }

    // If label value is not in the list of label values, skip it
    if (!labelValuesList.includes(labelValue)) {
      continue;
    }

    const labelValueHash = hashes.get(labelValue);

    keys[labelValueHash] = labelValue;

    if (skipStatuses.includes(tr.status)) {
      continue;
    }

    trsStatsByLabelValues.get(labelValueHash).total++;

    if (tr.status === "passed") {
      trsStatsByLabelValues.get(labelValueHash).passed++;
    }
  }

  return {
    // Add limits
    data: trsStatsByLabelValues.entries.map(([id, { passed, total }]) => ({
      id,
      stabilityRate: total > 0 ? getStabilityRate(passed, total) : 0,
    })),
    keys,
    type: ChartType.StabilityDistribution,
    title,
    threshold,
  };
};
