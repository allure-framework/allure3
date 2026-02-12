import type { AllureChartsStoreData, TrSeveritiesChartData, TrSeveritiesChartOptions } from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import type { SeverityLevel, TestResult, TestStatus } from "@allurereport/core-api";
import { severityLabelName, severityLevels, statusesList } from "@allurereport/core-api";

const DEFAULT_SEVERITY_LEVELS = [...severityLevels];
const UNSET_SEVERITY_LEVEL = "unset";
const SEVERITY_LABEL_NAME = severityLabelName;

const getSeverity = (tr: TestResult): SeverityLevel | "unset" => {
  const severityLabelValue = tr.labels?.find((label: { name: string }) => label.name === SEVERITY_LABEL_NAME)?.value;

  if (!severityLabelValue) {
    return UNSET_SEVERITY_LEVEL;
  }

  return severityLabelValue as SeverityLevel;
};

export const generateTrSeveritiesChart = (props: {
  options: TrSeveritiesChartOptions;
  storeData: AllureChartsStoreData;
}): TrSeveritiesChartData => {
  const { options, storeData } = props;
  const { levels, statuses, includeUnset = true } = options;

  let trSeverityLevels: (SeverityLevel | "unset")[] = levels as any;
  let trStatuses = statuses;

  if (!trSeverityLevels || trSeverityLevels.length === 0) {
    trSeverityLevels = DEFAULT_SEVERITY_LEVELS;
  }

  if (includeUnset) {
    trSeverityLevels.push(UNSET_SEVERITY_LEVEL);
  }

  if (!trStatuses || trStatuses.length === 0) {
    trStatuses = statusesList as TestStatus[];
  }

  const { testResults } = storeData;

  const data = new Map<SeverityLevel | "unset", Record<TestStatus, number>>();

  for (const severity of trSeverityLevels) {
    data.set(severity, Object.fromEntries(trStatuses.map((status) => [status, 0])) as Record<TestStatus, number>);
  }

  for (const tr of testResults) {
    if (!trStatuses.includes(tr.status)) {
      continue;
    }

    const severity = getSeverity(tr);

    if (!trSeverityLevels.includes(severity)) {
      continue;
    }

    const severityStats = data.get(severity)!;
    severityStats[tr.status]++;
  }

  return {
    type: ChartType.TrSeverities,
    title: options.title,
    data: trSeverityLevels.map((severity) => ({
      id: severity,
      ...data.get(severity)!,
    })),
    levels: trSeverityLevels,
    statuses: trStatuses,
  };
};
