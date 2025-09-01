import type { BarGroupValues, SeverityLevel, TestResult, TestStatus, BarGroup } from "@allurereport/core-api";
import { BarGroupMode, severityLabelName, severityLevels, statusesList } from "@allurereport/core-api";
import type { BarDataAccessor } from "./charts.js";

const processTestResults = (testResults: TestResult[]): BarGroup<SeverityLevel, TestStatus>[] => {
  const resultMap: Record<SeverityLevel, BarGroupValues<TestStatus> | undefined> = {
    blocker: undefined,
    critical: undefined,
    normal: undefined,
    minor: undefined,
    trivial: undefined,
  };

  severityLevels.forEach((severity) => {
    resultMap[severity] = statusesList.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as BarGroupValues<TestStatus>,
    );
  });

  // Process test results
  testResults.forEach((test) => {
    const severityLabel = test.labels?.find((label: { name: string }) => label.name === severityLabelName);
    const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

    if (severity && resultMap[severity]) {
      resultMap[severity][test.status] = (resultMap[severity][test.status] ?? 0) + 1;
    }
  });

  return Object.entries(resultMap).reduce((acc, [severity, values]) => {
    if (values) {
      acc.push({ groupId: severity as SeverityLevel, ...values });
    }

    return acc;
  }, [] as BarGroup<SeverityLevel, TestStatus>[]);
};

export const statusBySeverityBarDataAccessor: BarDataAccessor<SeverityLevel, TestStatus> = {
  getItems: ({testResults}) => {
    return processTestResults(testResults);
  },
  getGroupKeys: () => statusesList,
  getGroupMode: () => BarGroupMode.Grouped,
};
