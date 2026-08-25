import { describe, expect, it } from "vitest";

import { allure2 } from "../src/allure2/index.js";
import { readResults } from "./utils.js";

describe("allure2 performance reader", () => {
  it("reads a performance result file and keeps the raw file as a global attachment", async () => {
    const visitor = await readResults(allure2, {
      "perf/performance-result.json": "check-1-perf.json",
    });

    expect(visitor.visitMetrics).toHaveBeenCalledTimes(1);
    expect(visitor.visitMetrics.mock.calls[0][0]).toEqual([
      {
        id: "check-1",
        key: "browser.coldLoad",
        value: 550.4,
        start: 100,
        stop: 650.4,
      },
    ]);
    expect(visitor.visitMetrics.mock.calls[0][1]).toEqual({
      readerId: "allure2",
      metadata: {
        originalFileName: "check-1-perf.json",
      },
    });
    expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
    expect(visitor.visitGlobals.mock.calls[0][0].attachments[0]).toMatchObject({
      name: "check-1-perf.json",
      originalFileName: "check-1-perf.json",
    });
  });

  it("reads a bulk performance.json file", async () => {
    const visitor = await readResults(allure2, {
      "perf/performance-results.json": "performance.json",
    });

    expect(visitor.visitMetrics).toHaveBeenCalledTimes(1);
    expect(visitor.visitMetrics.mock.calls[0][0]).toEqual([
      {
        id: "check-1",
        key: "browser.coldLoad",
        value: 550.4,
        start: 100,
        stop: 650.4,
      },
      {
        id: "check-2",
        key: "api.checkout",
        value: 246.8,
        start: 700,
        stop: 946.8,
      },
    ]);
  });

  it("ignores performance files without required result fields", async () => {
    const visitor = await readResults(
      allure2,
      {
        "perf/invalid-performance-result.json": "invalid-perf.json",
      },
      false,
    );

    expect(visitor.visitMetrics).not.toHaveBeenCalled();
    expect(visitor.visitAttachmentFile).not.toHaveBeenCalled();
  });
});
