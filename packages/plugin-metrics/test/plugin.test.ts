import { mkdir, writeFile } from "node:fs/promises";

import type { CategoryDefinition, MetricSample, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetricsPlugin } from "../src/plugin.js";

vi.mock("node:fs/promises");

beforeEach(async () => {
  await story("plugin");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ALLURE_PROMETHEUS_LABELS;
});

const tr = (overrides: Partial<TestResult>): TestResult =>
  ({
    id: "1",
    name: "t",
    status: "passed",
    labels: [],
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

const createContext = (categories: CategoryDefinition[] = [productErrors]) => {
  const addFile = vi.fn().mockResolvedValue("");

  return { context: { reportFiles: { addFile }, categories } as unknown as PluginContext, addFile };
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
        options?.includeRetries ? [...results, ...retries] : results,
      ),
    allMetrics: vi.fn().mockResolvedValue(metrics),
  }) as unknown as AllureStore;

const written = (addFile: ReturnType<typeof vi.fn>, path: string) =>
  (addFile.mock.calls.find(([name]) => name === path)?.[1] as Buffer | undefined)?.toString("utf-8");

describe("MetricsPlugin", () => {
  it("writes both Allure 2 export files by default", async () => {
    const { context, addFile } = createContext();
    const store = createStore(
      [tr({ id: "1" }), tr({ id: "2", status: "failed" })],
      [tr({ id: "3", status: "failed" })],
    );

    await new MetricsPlugin().done(context, store);

    const prometheus = written(addFile, "export/prometheusData.txt")!;
    const influx = written(addFile, "export/influxDbData.txt")!;

    expect(prometheus).toContain("launch_status_passed 1\n");
    expect(prometheus).toContain("launch_status_failed 1\n");
    expect(prometheus).toContain("launch_problems_product_errors 1\n");
    expect(prometheus).toContain("launch_retries_retries 1\n");
    expect(prometheus).toContain("launch_retries_run 2\n");
    expect(prometheus).toContain("launch_time_duration 100\n");
    expect(influx).toMatch(/^launch_status failed=1 \d+000000000$/m);
  });

  it("exports only the configured section", async () => {
    const { context, addFile } = createContext();

    await new MetricsPlugin({ prometheus: { fileName: "m.prom", labels: { team: "qa" } } }).done(
      context,
      createStore([tr({})]),
    );

    expect(addFile).toHaveBeenCalledTimes(1);
    expect(written(addFile, "m.prom")).toContain('launch_status_passed{team="qa"} 1');
  });

  it("falls back to the labels from the environment", async () => {
    process.env.ALLURE_PROMETHEUS_LABELS = 'env="ci"';
    const { context, addFile } = createContext();

    await new MetricsPlugin({ prometheus: true }).done(context, createStore([tr({})]));

    expect(written(addFile, "export/prometheusData.txt")).toContain('launch_status_passed{env="ci"} 1');
  });

  it("writes absolute paths straight to disk", async () => {
    const { context, addFile } = createContext();

    await new MetricsPlugin({ influxdb: { fileName: "/tmp/out/influx.txt" } }).done(context, createStore([tr({})]));

    expect(addFile).not.toHaveBeenCalled();
    expect(mkdir).toHaveBeenCalledWith("/tmp/out", { recursive: true });
    expect(writeFile).toHaveBeenCalledWith("/tmp/out/influx.txt", expect.any(Buffer));
  });

  it("does nothing when both sections are disabled", async () => {
    const { context, addFile } = createContext();
    const store = createStore([tr({})]);

    await new MetricsPlugin({ prometheus: false, influxdb: false }).done(context, store);

    expect(addFile).not.toHaveBeenCalled();
    expect(store.testsStatistic).not.toHaveBeenCalled();
  });

  it("includes performance metrics only when requested", async () => {
    const samples = [{ id: "1", key: "ttfb", value: 10, start: 0, stop: 1 }] as MetricSample[];
    const off = createContext();
    const on = createContext();

    await new MetricsPlugin({ prometheus: true }).done(off.context, createStore([tr({})], [], samples));
    await new MetricsPlugin({ prometheus: true, performanceMetrics: true }).done(
      on.context,
      createStore([tr({})], [], samples),
    );

    expect(written(off.addFile, "export/prometheusData.txt")).not.toContain("launch_metric_ttfb");
    expect(written(on.addFile, "export/prometheusData.txt")).toContain("launch_metric_ttfb 10\n");
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
      const { context, addFile } = createContext();

      await new MetricsPlugin({ prometheus: { pushgateway: { url: "http://pg:9091" } } }).done(
        context,
        createStore([tr({})]),
      );

      expect(addFile).toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("ECONNREFUSED"));
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
  });
});
