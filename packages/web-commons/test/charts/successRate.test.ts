import type { AllureChartsStoreData } from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import type { TestResult, TestStatus } from "@allurereport/core-api";
import { attachment, step } from "allure-js-commons";
import { describe, expect, it } from "vitest";

import { createSuccessRateDistributionTreeMap } from "../../src/charts/accessors/successRateDistributionTreeMapAccessor.js";
import { getPieChartValues } from "../../src/charts/d3pie.js";
import { generateTestingPyramidChart } from "../../src/charts/generateTestingPyramidChart.js";

const testResults = (statuses: TestStatus[]): TestResult[] =>
  statuses.map(
    (status, index) =>
      ({
        id: String(index),
        name: `test ${index}`,
        status,
        labels: [
          { name: "epic", value: "Product" },
          { name: "feature", value: "Feature" },
          { name: "layer", value: "unit" },
        ],
      }) as TestResult,
  );

describe("success rate charts", () => {
  it("preserves all pie slices while excluding skipped and unknown from success", async () => {
    const stats = { total: 643, passed: 493, failed: 45, skipped: 95, unknown: 10 };
    const chart = getPieChartValues(stats);

    await attachment("pie input and output", JSON.stringify({ stats, chart }), "application/json");
    await step("Success is 91.63 percent while slice counts retain all 643 tests", () => {
      expect(chart.percentage).toBe(91.63);
      expect(chart.slices.reduce((sum, slice) => sum + slice.count, 0)).toBe(643);
      expect(chart.slices.find((slice) => slice.status === "skipped")?.count).toBe(95);
      expect(chart.slices.find((slice) => slice.status === "unknown")?.count).toBe(10);
    });
  });
  it.each([
    { statuses: ["passed", "broken", "skipped", "unknown"] as TestStatus[], eligible: 2, rate: 50 },
    { statuses: ["skipped", "unknown"] as TestStatus[], eligible: 0, rate: 0 },
  ])("preserves pyramid and treemap sizes for $statuses", async ({ statuses, eligible, rate }) => {
    const tests = testResults(statuses);
    const pyramid = generateTestingPyramidChart({ type: ChartType.TestingPyramid }, {
      testResults: tests,
    } as AllureChartsStoreData);
    const tree = createSuccessRateDistributionTreeMap(tests);

    await attachment("chart outputs", JSON.stringify({ statuses, pyramid, tree }), "application/json");
    await step("Layer counts include excluded tests; metric and subtree color use eligible counts", () => {
      expect(pyramid.data[0]).toMatchObject({
        testCount: tests.length,
        percentage: 100,
        eligibleCount: eligible,
        successRate: rate,
      });
      expect(tree.eligibleCount).toBe(eligible);
      expect(tree.colorValue).toBe(rate / 100);

      const leaves: (typeof tree)[] = [];
      const visit = (node: typeof tree) => (node.children?.length ? node.children.forEach(visit) : leaves.push(node));

      visit(tree);

      expect(leaves.reduce((sum, node) => sum + (node.value ?? 0), 0)).toBe(tests.length);
    });
  });
  it("returns a finite empty pie and empty subtree", () => {
    expect(getPieChartValues({ total: 0 }).percentage).toBe(0);
    expect(createSuccessRateDistributionTreeMap([]).eligibleCount).toBe(0);
    expect(createSuccessRateDistributionTreeMap([]).colorValue).toBe(0);
  });
});
