import { describe, expect, it } from "vitest";

import type { PluginSummary } from "@allurereport/plugin-api";

import { generateSummaryStaticFiles } from "../src/generators.js";

const makeSummary = (i: number): PluginSummary => ({
  name: `Report ${i}`,
  stats: {
    total: 1,
    passed: 1,
    failed: 0,
    broken: 0,
    skipped: 0,
    unknown: 0,
  },
  status: "passed",
  duration: 1,
  href: `${i}/`,
});

describe("summary generators", () => {
  it("should generate HTML with reportSummaries defined before main script when there are >20 summaries", async () => {
    const summaries = Array.from({ length: 21 }, (_, i) => makeSummary(i));
    const html = await generateSummaryStaticFiles({ summaries });

    // Ensure all summaries are embedded (no truncation)
    expect(html).toContain("window.reportSummaries");
    expect(html).toContain("Report 20");

    // Ensure ordering: data comes before app bundle script
    const reportSummariesPos = html.indexOf("window.reportSummaries");
    const mainScriptPos = html.indexOf("data:text/javascript;base64,");
    expect(reportSummariesPos).toBeGreaterThan(-1);
    expect(mainScriptPos).toBeGreaterThan(-1);
    expect(reportSummariesPos).toBeLessThan(mainScriptPos);
  });
});
