import { describe, expect, it } from "vitest";
import type { TestResult, TestStatus } from "../../src/model.js";
import { getWorstStatus, statusToPriority } from "../../src/utils/status.js";

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
    const result = getWorstStatus(
      [{ status: "passed" }, { status: "failed" }, { status: "skipped" }] as TestResult[],
      (item) => item.status,
    );

    expect(result).toEqual("failed");
  });

  it("should process given items as statuses list when no accessor is given", () => {
    const result = getWorstStatus(["passed", "failed", "skipped"] as TestStatus[]);

    expect(result).toEqual("failed");
  });

  it("should return undefined when no items are given", () => {
    const result = getWorstStatus([] as TestResult[], (item) => item.status);

    expect(result).toBeUndefined();
  });
});
