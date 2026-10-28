import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildMetricHierarchy, type PerformanceConfig } from "@allurereport/core-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { readConfig, resolveConfig } from "../src/config.js";
import { AllureReport } from "../src/report.js";
import { DefaultAllureStore } from "../src/store/store.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const performance: PerformanceConfig = {
  metrics: {
    run: { title: "Generate report", unit: "ms", better: "lower" },
    read: { title: "Read", unit: "ms", better: "lower", parent: "run" },
    parse: { title: "Parse", unit: "ms", better: "lower", parent: "read" },
  },
};

describe("configured performance hierarchy", () => {
  it("rejects invalid hierarchy during config resolution and direct report construction", async () => {
    const invalid = { metrics: { read: { ...performance.metrics!.read, parent: "missing" } } };
    await expect(resolveConfig({ performance: invalid })).rejects.toThrow('Unknown parent "missing"');
    const config = await resolveConfig({ plugins: {} });
    expect(() => new AllureReport({ ...config, performance: invalid })).toThrow('Unknown parent "missing"');
  });

  it("keeps configured intermediate nodes when measurements are missing without changing widget samples or history", async () => {
    const directory = await mkdtemp(join(tmpdir(), "allure-metric-hierarchy-"));
    directories.push(directory);
    const historyPath = join(directory, "history.jsonl");
    const resultsDir = join(directory, "results");
    const output = join(directory, "report");
    const results = [
      { id: "parse-one", key: "parse", value: 2, start: 0, stop: 2 },
      { id: "parse-two", key: "parse", value: 4, start: 1, stop: 5 },
      { id: "run", key: "run", value: 10, start: 0, stop: 10 },
    ];
    const config = await resolveConfig({ name: "Hierarchy", output, historyPath, performance, plugins: {} });
    config.plugins = [{ id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({}) }];
    const report = new AllureReport(config);
    await writeFile(historyPath, "");
    await mkdir(resultsDir);
    const resultFile = join(resultsDir, "sample-perf.json");
    await writeFile(resultFile, JSON.stringify(results));
    await report.start();
    await report.readDirectory(resultsDir);
    await report.done();

    const widget = JSON.parse(await readFile(join(output, "widgets", "metrics.json"), "utf8"));
    expect(widget).not.toHaveProperty("hierarchy");
    expect(buildMetricHierarchy(config.performance)).toEqual([
      { key: "run", children: [{ key: "read", children: [{ key: "parse", children: [] }] }] },
    ]);
    expect(
      widget.current.map(({ id, key, value, start, stop }: (typeof results)[number]) => ({
        id,
        key,
        value,
        start,
        stop,
      })),
    ).toEqual(results);
    expect(widget.current.every((sample: object) => !Object.hasOwn(sample, "parent"))).toBe(true);
    const history = JSON.parse((await readFile(historyPath, "utf8")).trim());
    expect(history.metrics).toEqual({ run: 10, parse: 3 });
  });

  it("restores the existing flat metadata snapshot independently of destination hierarchy", async () => {
    const source = new DefaultAllureStore({ performance });
    const results = [
      { id: "read", key: "read", value: 8, start: 0, stop: 8 },
      { id: "run", key: "run", value: 10, start: 0, stop: 10 },
    ];
    await source.visitMetrics(results);
    const dump = structuredClone(source.dumpState());
    const destination = new DefaultAllureStore();
    await destination.restoreState(dump);
    expect(await destination.allMetrics()).toEqual(
      results.map((result) => ({
        ...result,
        title: performance.metrics![result.key].title,
        unit: "ms",
        better: "lower",
      })),
    );
    const destinationPerformance: PerformanceConfig = {
      metrics: {
        ...performance.metrics,
        other: { title: "Other root", unit: "ms", better: "lower" },
        read: { ...performance.metrics!.read, title: "New display title", parent: "other" },
      },
    };
    const reparented = new DefaultAllureStore({ performance: destinationPerformance });
    await reparented.restoreState(dump);
    expect(await reparented.allMetrics()).toEqual(await source.allMetrics());
    expect(buildMetricHierarchy(destinationPerformance)).toEqual([
      { key: "other", children: [{ key: "read", children: [{ key: "parse", children: [] }] }] },
      { key: "run", children: [] },
    ]);
    expect(dump).toEqual(source.dumpState());
  });

  it("uses explicit parents in the real report config without nesting independent AQL benchmarks", async () => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const config = await readConfig(root, "allurerc.mjs");
    const performance = config.performance;
    if (!performance) {
      throw new Error("Expected the report configuration to define performance metrics");
    }
    const tree = buildMetricHierarchy(performance);
    const metricKeys = Object.keys(performance.metrics ?? {});
    expect(metricKeys.filter((key) => key.startsWith("aql.parse."))).toHaveLength(5);
    expect(metricKeys.filter((key) => key.startsWith("aql.filter."))).toHaveLength(8);
    expect(metricKeys.filter((key) => key.startsWith("aql.workflow."))).toHaveLength(2);
    const run = tree.find(({ key }) => key === "allure.total")!;
    expect(run.children.map(({ key }) => key)).toEqual(["generate.total", "restoreState.total", "summary.generate"]);
    const generate = run.children.find(({ key }) => key === "generate.total")!;
    expect(generate.children.map(({ key }) => key)).toEqual(["generate.plugins.done", "generate.readResults"]);
    expect(tree.find(({ key }) => key === "aql.parse.simple")).toEqual({ key: "aql.parse.simple", children: [] });
    expect(metricKeys.filter((key) => key.startsWith("generate.plugin.done.")).sort()).toEqual([
      "generate.plugin.done.allure2",
      "generate.plugin.done.awesome",
      "generate.plugin.done.classic",
      "generate.plugin.done.dashboard",
      "generate.plugin.done.log",
      "generate.plugin.done.testops",
    ]);
    expect(tree.find(({ key }) => key === "publish.upload.total")!.children.map(({ key }) => key)).toEqual([
      "publish.upload.plugin.allure2",
      "publish.upload.plugin.awesome",
      "publish.upload.plugin.classic",
      "publish.upload.plugin.dashboard",
    ]);
  });
});
