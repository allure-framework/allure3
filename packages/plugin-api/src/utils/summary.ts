import type { TestResult } from "@allurereport/core-api";
import type { SummaryTestResult } from "../plugin.js";

export const convertToSummaryTestResult = (tr: TestResult): SummaryTestResult => ({
  id: tr.id,
  name: tr.name,
  status: tr.status,
  duration: tr.duration,
});
