import { describe, expect, it } from "vitest";

import { isReportDataFile } from "../src/index.js";

describe("isReportDataFile", () => {
  it("should identify report data files", () => {
    expect(isReportDataFile("index.html")).toBe(true);
    expect(isReportDataFile("summary.json")).toBe(true);
    expect(isReportDataFile("data/results.json")).toBe(true);
    expect(isReportDataFile("widgets/summary.json")).toBe(true);
    expect(isReportDataFile("history/history.json")).toBe(true);
  });

  it("should reject shared assets and non-nested data directories", () => {
    expect(isReportDataFile("app.js")).toBe(false);
    expect(isReportDataFile("styles.css")).toBe(false);
    expect(isReportDataFile("data")).toBe(false);
    expect(isReportDataFile("widgets")).toBe(false);
    expect(isReportDataFile("history")).toBe(false);
  });
});
