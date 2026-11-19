import type { ReportTestResult } from "@allurereport/plugin-api";
import { preciseTreeLabels } from "@allurereport/plugin-api";

export const DEFAULT_SUITES_LABELS = ["parentSuite", "suite", "subSuite"];
export const BEHAVIORS_LABELS = ["epic", "feature", "story"];
export const PACKAGES_LABELS = ["package"];

const labelNames = ({ labels }: ReportTestResult) => labels.map(({ name }) => name);

/**
 * Resolves the labels each classic tree is built by.
 * The `groupBy` option customizes the Suites tree only: Behaviors and Packages keep their Allure 2 structure.
 */
export const resolveTreeLabels = (groupBy: string[] | undefined, tests: ReportTestResult[]) => ({
  tree: preciseTreeLabels(groupBy?.length ? groupBy : DEFAULT_SUITES_LABELS, tests, labelNames),
  behaviors: preciseTreeLabels(BEHAVIORS_LABELS, tests, labelNames),
  packages: preciseTreeLabels(PACKAGES_LABELS, tests, labelNames),
});
