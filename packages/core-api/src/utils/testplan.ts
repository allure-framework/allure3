import type { TestPlan, TestPlanTest, TestResult } from "../index.js";
import { findByLabelName } from "./label.js";

const createTestPlanTests = (testResults: TestResult[]): TestPlanTest[] => {
  const seenIds = new Set<string>();
  const seenSelectors = new Set<string>();

  return testResults
    .map((tr) => ({
      selector: tr.runSelector ?? tr.fullName,
      id: findByLabelName(tr.labels, "ALLURE_ID"),
      testCaseId: tr.testCase?.externalId,
      environment: tr.environment,
    }))
    .filter(
      (value) =>
        (value.selector && (seenSelectors.has(value.selector) ? false : !!seenSelectors.add(value.selector))) ||
        (value.id && (seenIds.has(value.id) ? false : !!seenSelectors.add(value.id))),
    );
};

export const createTestPlan = (testResults: TestResult[], mutedTestResults: TestResult[] = []): TestPlan => ({
  version: "1.0",
  tests: createTestPlanTests(testResults),
  mutedTests: createTestPlanTests(mutedTestResults),
});
