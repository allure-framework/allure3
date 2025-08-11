import type { SeverityLevel, TestResult, TestStatus } from "@allurereport/core-api";
import { severityLabelName, severityLevels, statusesList } from "@allurereport/core-api";
import type { BarDataAccessor, BarStats } from "./charts.js";
import type { AllureStore } from "./store.js";

const processTestResults = (testResults: TestResult[]): BarStats<SeverityLevel, TestStatus> => {
  const result: BarStats<SeverityLevel, TestStatus> = {
    blocker: undefined,
    critical: undefined,
    normal: undefined,
    minor: undefined,
    trivial: undefined,
  };

  // Initialize all severity levels with empty status counts
  severityLevels.forEach((severity) => {
    result[severity] = statusesList.reduce((acc, status) => ({ ...acc, [status]: 0 }), {} as Record<TestStatus, number>);
  });

  // Process test results
  testResults.forEach((test) => {
    const severityLabel = test.labels?.find((label: { name: string }) => label.name === severityLabelName);
    const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

    if (severity && result[severity]) {
      result[severity][test.status] = (result[severity][test.status] ?? 0) + 1;
    }
  });

  return result;
};

export const statusBySeverityBarDataAccessor: BarDataAccessor<SeverityLevel, TestStatus> = {
  getCurrentData: async (store: AllureStore): Promise<BarStats<SeverityLevel, TestStatus>> => {
    const testResults = await store.allTestResults();

    return processTestResults(testResults);
  },
  getAllValues: () => severityLevels,
  getIndexBy: () => "severity",
};
