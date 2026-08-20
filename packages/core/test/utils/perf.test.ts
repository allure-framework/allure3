import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import type { PerformanceConfig } from "@allurereport/core-api";
import { afterEach, describe, expect, it } from "vitest";

import {
  getPerfMetricsPayload,
  mergePerformanceConfig,
  measurePerf,
  PERF_METRICS_FILE,
  PERF_METRIC_NAMES,
  resetPerfMetrics,
  startPerfSpan,
  writePerfMetrics,
} from "../../src/utils/perf.js";

const allurePerfEntries = () => performance.getEntries().filter(({ name }) => name.startsWith("allure:perf:"));

describe("perf metrics", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    delete process.env.ALLURE_PERF_METRICS;
    resetPerfMetrics();
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  const tempDir = async () => {
    const dir = await mkdtemp(join(tmpdir(), "allure-perf-"));

    tempDirs.push(dir);

    return dir;
  };

  it("does not write metrics when disabled", async () => {
    const output = await tempDir();

    await measurePerf(PERF_METRIC_NAMES.generateTotal, async () => {});

    await expect(writePerfMetrics(output)).resolves.toBe(false);
    expect(existsSync(join(output, PERF_METRICS_FILE))).toBe(false);
    expect(getPerfMetricsPayload().results).toEqual([]);
  });

  it("records nested async spans when enabled", async () => {
    process.env.ALLURE_PERF_METRICS = "1";

    await measurePerf(PERF_METRIC_NAMES.generateTotal, async () => {
      await measurePerf(PERF_METRIC_NAMES.generatePluginsDone, async () => {});
    });

    const payload = getPerfMetricsPayload();

    expect(payload.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: PERF_METRIC_NAMES.allureTotal, value: expect.any(Number) }),
        expect.objectContaining({ key: PERF_METRIC_NAMES.generateTotal, value: expect.any(Number) }),
        expect.objectContaining({ key: PERF_METRIC_NAMES.generatePluginsDone, value: expect.any(Number) }),
      ]),
    );
  });

  it("records spans when the measured function fails", async () => {
    process.env.ALLURE_PERF_METRICS = "1";

    await expect(
      measurePerf(PERF_METRIC_NAMES.generatePluginsDone, async () => {
        throw new Error("generation failed");
      }),
    ).rejects.toThrow("generation failed");

    expect(getPerfMetricsPayload().results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: PERF_METRIC_NAMES.allureTotal, value: expect.any(Number) }),
        expect.objectContaining({ key: PERF_METRIC_NAMES.generatePluginsDone, value: expect.any(Number) }),
      ]),
    );
  });

  it("clears perf_hooks marks and measures after each span", async () => {
    process.env.ALLURE_PERF_METRICS = "1";

    const end = startPerfSpan(PERF_METRIC_NAMES.restoreStateTotal);

    end();

    expect(allurePerfEntries()).toEqual([]);
  });

  it("writes a compact metrics json file and resets collected spans", async () => {
    process.env.ALLURE_PERF_METRICS = "1";
    const output = await tempDir();

    await measurePerf(PERF_METRIC_NAMES.summaryGenerate, async () => {});

    await expect(writePerfMetrics(output)).resolves.toBe(true);

    const payload = JSON.parse(await readFile(join(output, PERF_METRICS_FILE), "utf8"));

    expect(payload.results).toEqual([
      expect.objectContaining({
        key: PERF_METRIC_NAMES.allureTotal,
        value: expect.any(Number),
        start: expect.any(Number),
        stop: expect.any(Number),
      }),
      expect.objectContaining({
        key: PERF_METRIC_NAMES.summaryGenerate,
        value: expect.any(Number),
        start: expect.any(Number),
        stop: expect.any(Number),
      }),
    ]);
    expect(getPerfMetricsPayload().results).toEqual([]);
  });

  it("merges performance metric entries without dropping base metadata", () => {
    expect(
      mergePerformanceConfig(
        {
          metrics: {
            "allure.total": {
              title: "Allure total",
              unit: "ms",
              better: "lower",
              group: "allure",
            },
          },
        },
        {
          metrics: {
            "allure.total": {
              title: "Total generation",
            },
          },
        } as unknown as PerformanceConfig,
      ),
    ).toEqual({
      metrics: {
        "allure.total": {
          title: "Total generation",
          unit: "ms",
          better: "lower",
          group: "allure",
        },
      },
      groups: {},
    });
  });
});
