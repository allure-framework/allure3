import type { ErrorMatchingData, TestLabel } from "@allurereport/core-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";

export const extractMatchingData = (tr: AwesomeTestResult): ErrorMatchingData => {
  const { message, trace } = tr.error!;

  const labels: TestLabel[] = Array.isArray(tr.labels)
    ? tr.labels.map((l) => ({ name: l.name, value: l.value ?? "" }))
    : [];

  return {
    status: tr.status,
    labels,
    message,
    trace,
    flaky: tr.flaky,
  };
};
