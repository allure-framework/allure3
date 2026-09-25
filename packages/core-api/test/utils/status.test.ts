import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { TestStatus } from "../../src/model.js";
import { getWorstStatus, hasRetriesStatusChange, statusToPriority } from "../../src/utils/status.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-data-model");
  await story("status");
  await label("coverage", "report-data-model");
});

describe("statusToPriority", () => {
  it("should return priority of status", () => {
    expect(statusToPriority("failed")).toEqual(0);
    expect(statusToPriority("broken")).toEqual(1);
    expect(statusToPriority("passed")).toEqual(2);
    expect(statusToPriority("skipped")).toEqual(3);
    expect(statusToPriority("unknown")).toEqual(4);
  });

  it("should return -1 when no status is given", () => {
    const result = statusToPriority(undefined);

    expect(result).toEqual(-1);
  });
});

describe("getWorstStatus", () => {
  it("should return worst status", () => {
    const result = getWorstStatus(["passed", "failed", "skipped"]);

    expect(result).toEqual("failed");
  });

  it("should process given items as statuses list when no accessor is given", () => {
    const result = getWorstStatus(["passed", "failed", "skipped"] as TestStatus[]);

    expect(result).toEqual("failed");
  });

  it("should return undefined when no items are given", () => {
    const result = getWorstStatus([]);

    expect(result).toBeUndefined();
  });
});

describe("hasRetriesStatusChange", () => {
  const significantStatuses = ["passed", "failed", "broken"] as const satisfies readonly TestStatus[];

  it.each([
    ...significantStatuses.flatMap((currentStatus) =>
      significantStatuses.map(
        (retryStatus) =>
          [currentStatus, [retryStatus], retryStatus !== currentStatus] satisfies [TestStatus, TestStatus[], boolean],
      ),
    ),
    ["passed", ["unknown", "skipped"], false],
    ["unknown", ["passed", "failed"], false],
    ["passed", [], false],
    ["passed", ["unknown", "failed", "passed"], true],
    ["passed", ["failed", "passed", "broken", "failed"], true],
  ] satisfies [TestStatus, TestStatus[], boolean][])(
    "detects change for current status %s and retry statuses %j: %s",
    (currentStatus, retryStatuses, expected) => {
      expect(
        hasRetriesStatusChange(
          { status: currentStatus },
          retryStatuses.map((status) => ({ status })),
        ),
      ).toBe(expected);
    },
  );
});
