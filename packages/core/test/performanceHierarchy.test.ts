import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildMetricHierarchy, type PerformanceConfig } from "@allurereport/core-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { resolveConfig } from "../src/config.js";
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

  it("reads raw results into a key tree without collapsing repeated or overlapping measurements or changing history", async () => {
    const directory = await mkdtemp(join(tmpdir(), "allure-metric-hierarchy-"));
    directories.push(directory);
    const historyPath = join(directory, "history.jsonl");
    const resultsDir = join(directory, "results");
    const output = join(directory, "report");
    const results = [
      { id: "read-one", key: "read", value: 8, start: 0, stop: 8 },
      { id: "read-two", key: "read", value: 8, start: 1, stop: 9 },
      { id: "parse", key: "parse", value: 2, start: 2, stop: 4 },
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
    expect(buildMetricHierarchy(widget.current)).toEqual([
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
    expect(
      widget.current
        .filter(({ key }: { key: string }) => key === "read")
        .map(({ parent }: { parent: string }) => parent),
    ).toEqual(["run", "run"]);
    const history = JSON.parse((await readFile(historyPath, "utf8")).trim());
    expect(history.metrics).toEqual({ run: 10, read: 8, parse: 2 });
  });

  it("uses the destination hierarchy when restoring a dump, including removal of old parents", async () => {
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
    expect(buildMetricHierarchy(await destination.allMetrics())).toEqual([
      { key: "read", children: [] },
      { key: "run", children: [] },
    ]);
    const reparented = new DefaultAllureStore({
      performance: {
        metrics: {
          ...performance.metrics,
          other: { title: "Other root", unit: "ms", better: "lower" },
          read: { ...performance.metrics!.read, title: "New display title", parent: "other" },
        },
      },
    });
    await reparented.restoreState(dump);
    expect((await reparented.allMetrics()).find(({ key }) => key === "read")).toMatchObject({
      parent: "other",
      title: "Read",
      value: 8,
      id: "read",
    });
    expect(dump).toEqual(source.dumpState());
  });
});
