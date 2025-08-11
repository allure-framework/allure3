import type { BarGroupValues, SeverityLevel, TestResult, TestStatus } from "@allurereport/core-api";
import { BarGroupMode, severityLabelName, severityLevels, statusesList } from "@allurereport/core-api";
import type { BarDataAccessor, BarStats } from "./charts.js";
import type { AllureStore } from "./store.js";

const processTestResults = (testResults: TestResult[]): BarStats<SeverityLevel, TestStatus> => {
  const resultMap: Record<SeverityLevel, BarGroupValues<TestStatus> | undefined> = {
    blocker: undefined,
    critical: undefined,
    normal: undefined,
    minor: undefined,
    trivial: undefined,
  };

  severityLevels.forEach((severity) => {
    resultMap[severity] = statusesList.reduce((acc, status) => ({ ...acc, [status]: 0 }), {} as BarGroupValues<TestStatus>);
  });

  // Process test results
  testResults.forEach((test) => {
    const severityLabel = test.labels?.find((label: { name: string }) => label.name === severityLabelName);
    const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

    if (severity && resultMap[severity]) {
      resultMap[severity][test.status] = (resultMap[severity][test.status] ?? 0) + 1;
    }
  });

  return Object.entries(resultMap).map(([severity, values]) => {
    if (values) {
      return { groupId: severity, ...values };
    }
  }).filter(Boolean) as BarStats<SeverityLevel, TestStatus>;
};

export const statusBySeverityBarDataAccessor: BarDataAccessor<SeverityLevel, TestStatus> = {
  getCurrentData: async (store: AllureStore): Promise<BarStats<SeverityLevel, TestStatus>> => {
    const testResults = await store.allTestResults();

    return processTestResults(testResults);
  },
  getValuesKeys: () => statusesList,
  getGroupMode: () => BarGroupMode.Grouped,
};
