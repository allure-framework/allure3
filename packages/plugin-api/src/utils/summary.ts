import { TestResult } from "@allurereport/core-api";
import { SummaryTestResult } from "../plugin.js";

export const convertToSummaryTestResult = (tr: TestResult): SummaryTestResult => ({
  id: tr.id,
  name: tr.name,
  status: tr.status,
  duration: tr.duration,
});
