import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CategoryDefinition, MetricSample, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetricsPlugin } from "../src/plugin.js";

let output: string;

beforeEach(async () => {
  await story("plugin");
  output = await mkdtemp(join(tmpdir(), "allure-metrics-"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ALLURE_PROMETHEUS_LABELS;
  await rm(output, { recursive: true, force: true });
});

const tr = (overrides: Partial<TestResult>): TestResult =>
  ({
    id: "1",
    name: "t",
    status: "passed",
    labels: [],
    isRetry: false,
    start: 100,
    stop: 200,
    duration: 100,
    ...overrides,
  }) as TestResult;

const productErrors = {
  id: "p",
  name: "Product errors",
  matchers: [{ statuses: ["failed"] }],
  groupBy: [],
  groupByMessage: false,
  index: 0,
} as unknown as CategoryDefinition;

// the same scoping the core applies: everything added through `reportFiles` ends up in `<output>/metrics/...`
const createContext = (categories: CategoryDefinition[] = [productErrors]) => {
  const addFile = vi.fn().mockImplementation(async (path: string) => join(output, "metrics", path));

  return {
    context: { id: "metrics", output, reportFiles: { addFile }, categories } as unknown as PluginContext,
    addFile,
  };
};

const createStore = (results: TestResult[], retries: TestResult[] = [], metrics: MetricSample[] = []) =>
  ({
    testsStatistic: vi.fn().mockResolvedValue({
      total: results.length,
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
    }),
    allTestResults: vi
      .fn()
      .mockImplementation(async (options?: { includeRetries?: boolean }) =>
        options?.includeRetries ? [...results, ...retries.map((r) => ({ ...r, isRetry: true }))] : results,
      ),
    allMetrics: vi.fn().mockResolvedValue(metrics),
  }) as unknown as AllureStore;

const written = (path: string) => readFile(join(output, path), "utf-8");

describe("MetricsPlugin", () => {
  it("writes both Allure 2 export files by default", async () => {
    const { context } = createContext();
    const store = createStore(
      [tr({ id: "1" }), tr({ id: "2", status: "failed" })],
      [tr({ id: "3", status: "failed" })],
    );

    await new MetricsPlugin().done(context, store);

    const prometheus = await written("export/prometheusData.txt");
    const influx = await written("export/influxDbData.txt");

    expect(prometheus).toContain("launch_status_passed 1\n");
    expect(prometheus).toContain("launch_status_failed 1\n");
    expect(prometheus).toContain("launch_problems_product_errors 1\n");
    expect(prometheus).toContain("launch_retries_retries 1\n");
    expect(prometheus).toContain("launch_retries_run 2\n");
    expect(prometheus).toContain("launch_time_duration 100\n");
    expect(influx).toMatch(/^launch_status failed=1 \d+000000000$/m);
  });

  it("writes the files to the report root, not to the plugin directory", async () => {
    const { context, addFile } = createContext();

    await new MetricsPlugin().done(context, createStore([tr({})]));

    expect(existsSync(join(output, "export", "prometheusData.txt"))).toBe(true);
    expect(existsSync(join(output, "export", "influxDbData.txt"))).toBe(true);
    expect(existsSync(join(output, "metrics"))).toBe(false);
    expect(addFile).not.toHaveBeenCalled();
  });

  it("exports only the configured section", async () => {
    const { context } = createContext();

    await new MetricsPlugin({ prometheus: { fileName: "m.prom", labels: { team: "qa" } } }).done(
      context,
      createStore([tr({})]),
    );

    expect(await written("m.prom")).toContain('launch_status_passed{team="qa"} 1');
    expect(existsSync(join(output, "export"))).toBe(false);
  });

  it("falls back to the labels from the environment", async () => {
    process.env.ALLURE_PROMETHEUS_LABELS = 'env="ci"';
    const { context } = createContext();

    await new MetricsPlugin({ prometheus: true }).done(context, createStore([tr({})]));

    expect(await written("export/prometheusData.txt")).toContain('launch_status_passed{env="ci"} 1');
  });

  it("writes absolute paths to that location", async () => {
    const { context } = createContext();
    const target = join(output, "elsewhere", "influx.txt");

    await new MetricsPlugin({ influxdb: { fileName: target } }).done(context, createStore([tr({})]));

    expect(await readFile(target, "utf-8")).toContain("launch_status passed=1");
  });

  it("refuses to write relative paths outside of the report directory", async () => {
    const { context } = createContext();

    await expect(
      new MetricsPlugin({ prometheus: { fileName: "../outside.txt" } }).done(context, createStore([tr({})])),
    ).rejects.toThrow(/outside of the report directory/);
  });

  it("does nothing when both sections are disabled", async () => {
    const { context } = createContext();
    const store = createStore([tr({})]);

    await new MetricsPlugin({ prometheus: false, influxdb: false }).done(context, store);

    expect(existsSync(join(output, "export"))).toBe(false);
    expect(store.testsStatistic).not.toHaveBeenCalled();
  });

  it("includes performance metrics only when requested", async () => {
    const samples = [{ id: "1", key: "ttfb", value: 10, start: 0, stop: 1 }] as MetricSample[];
    const off = createContext();

    await new MetricsPlugin({ prometheus: { fileName: "off.txt" } }).done(
      off.context,
      createStore([tr({})], [], samples),
    );
    await new MetricsPlugin({ prometheus: { fileName: "on.txt" }, performanceMetrics: true }).done(
      off.context,
      createStore([tr({})], [], samples),
    );

    expect(await written("off.txt")).not.toContain("launch_metric_ttfb");
    expect(await written("on.txt")).toContain("launch_metric_ttfb 10\n");
  });

  describe("push", () => {
    it("pushes to the Pushgateway and InfluxDB after writing the files", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      const { context } = createContext();

      await new MetricsPlugin({
        prometheus: { pushgateway: { url: "http://pg:9091", job: "ci" } },
        influxdb: { push: { url: "http://influx:8086", db: "allure" } },
      }).done(context, createStore([tr({})]));

      expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
        ["http://pg:9091/metrics/job/ci", "PUT"],
        ["http://influx:8086/write?db=allure&precision=ns", "POST"],
      ]);
    });

    it("only warns when a push fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { context } = createContext();

      await new MetricsPlugin({ prometheus: { pushgateway: { url: "http://pg:9091" } } }).done(
        context,
        createStore([tr({})]),
      );

      expect(existsSync(join(output, "export", "prometheusData.txt"))).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("ECONNREFUSED"));
    });

    it("reports every failed push and passes a timeout signal to fetch", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("down"));
      vi.stubGlobal("fetch", fetchMock);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { context } = createContext();

      await new MetricsPlugin({
        prometheus: { pushgateway: { url: "http://pg:9091" } },
        influxdb: { push: { url: "http://influx:8086", db: "allure" } },
        pushTimeout: 500,
      }).done(context, createStore([tr({})]));

      expect(warn).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls.every(([, init]) => init.signal instanceof AbortSignal)).toBe(true);
    });

    it("rethrows a push failure with failOnPushError", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
      const { context } = createContext();

      await expect(
        new MetricsPlugin({ prometheus: { pushgateway: { url: "http://pg:9091" } }, failOnPushError: true }).done(
          context,
          createStore([tr({})]),
        ),
      ).rejects.toThrow("ECONNREFUSED");
    });

    it("fails fast on an InfluxDB 2.x push without an organization, even without failOnPushError", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { context } = createContext();

      await expect(
        new MetricsPlugin({ influxdb: { push: { url: "http://influx:8086", bucket: "allure" } } }).done(
          context,
          createStore([tr({})]),
        ),
      ).rejects.toThrow(/`org`/);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(existsSync(join(output, "export"))).toBe(false);
    });
  });
});
