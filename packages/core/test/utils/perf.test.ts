import { performance } from "node:perf_hooks";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { measurePerf, PERF_METRIC_NAMES, startPerfSpan } from "../../src/utils/perf.js";

const names = [PERF_METRIC_NAMES.generateTotal, PERF_METRIC_NAMES.generatePluginsDone];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const name of names) {
    performance.clearMeasures(name);
  }
});

describe("performance measures", () => {
  it("does not create native entries when profiling is disabled", async () => {
    vi.stubEnv("ALLURE_PERF_METRICS", "");
    await expect(measurePerf(names[0], async () => "result")).resolves.toBe("result");
    expect(performance.getEntriesByName(names[0])).toEqual([]);
  });

  it("creates nested measures under their stable metric keys", async () => {
    vi.stubEnv("ALLURE_PERF_METRICS", "1");
    const value = {};
    await expect(measurePerf(names[0], () => measurePerf(names[1], async () => value))).resolves.toBe(value);
    for (const name of names) {
      expect(performance.getEntriesByName(name, "measure")).toHaveLength(1);
    }
  });

  it("keeps parallel operations with the same name separate", async () => {
    vi.stubEnv("ALLURE_PERF_METRICS", "1");
    const endFirst = startPerfSpan(names[0]);
    const endSecond = startPerfSpan(names[0]);
    endSecond();
    endFirst();
    endFirst();
    expect(performance.getEntriesByName(names[0], "measure")).toHaveLength(2);
  });

  it("preserves the original operation error and still ends the measure", async () => {
    vi.stubEnv("ALLURE_PERF_METRICS", "1");
    const error = new Error("generation failed");
    await expect(
      measurePerf(names[0], async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(performance.getEntriesByName(names[0], "measure")).toHaveLength(1);
  });

  it("clears only its own marks and leaves application entries alone", () => {
    vi.stubEnv("ALLURE_PERF_METRICS", "1");
    performance.mark("application.start");
    performance.measure("application.measure", { start: 0, duration: 1 });
    try {
      startPerfSpan(names[0])();
      expect(performance.getEntriesByType("mark").filter(({ name }) => name.startsWith("allure:perf:"))).toEqual([]);
      expect(performance.getEntriesByName("application.start", "mark")).toHaveLength(1);
      expect(performance.getEntriesByName("application.measure", "measure")).toHaveLength(1);
    } finally {
      performance.clearMarks("application.start");
      performance.clearMeasures("application.measure");
    }
  });
});
