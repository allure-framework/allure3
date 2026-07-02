import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { afterEach, describe, expect, it } from "vitest";

import {
  getPerfMetricsPayload,
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
    expect(getPerfMetricsPayload().spans).toEqual([]);
  });

  it("records nested async spans when enabled", async () => {
    process.env.ALLURE_PERF_METRICS = "1";

    await measurePerf(PERF_METRIC_NAMES.generateTotal, async () => {
      await measurePerf(PERF_METRIC_NAMES.generatePluginsDone, async () => {});
    });

    const payload = getPerfMetricsPayload();

    expect(payload.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: PERF_METRIC_NAMES.allureTotal, count: 1 }),
        expect.objectContaining({ name: PERF_METRIC_NAMES.generateTotal, count: 1 }),
        expect.objectContaining({ name: PERF_METRIC_NAMES.generatePluginsDone, count: 1 }),
      ]),
    );
    expect(payload.display).toEqual({ historyMetricKey: `${PERF_METRIC_NAMES.allureTotal}.avgMs` });
  });

  it("records spans when the measured function fails", async () => {
    process.env.ALLURE_PERF_METRICS = "1";

    await expect(
      measurePerf(PERF_METRIC_NAMES.generatePluginsDone, async () => {
        throw new Error("generation failed");
      }),
    ).rejects.toThrow("generation failed");

    expect(getPerfMetricsPayload().summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: PERF_METRIC_NAMES.allureTotal, count: 1 }),
        expect.objectContaining({ name: PERF_METRIC_NAMES.generatePluginsDone, count: 1 }),
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

    expect(payload.spans).toEqual([
      expect.objectContaining({
        name: PERF_METRIC_NAMES.summaryGenerate,
        startTimeMs: expect.any(Number),
        durationMs: expect.any(Number),
      }),
    ]);
    expect(payload.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: PERF_METRIC_NAMES.allureTotal, count: 1 }),
        expect.objectContaining({ name: PERF_METRIC_NAMES.summaryGenerate, count: 1 }),
      ]),
    );
    expect(payload.display).toEqual({ historyMetricKey: `${PERF_METRIC_NAMES.allureTotal}.avgMs` });
    expect(getPerfMetricsPayload().spans).toEqual([]);
  });
});
