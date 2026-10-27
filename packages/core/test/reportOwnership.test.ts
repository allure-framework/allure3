import console from "node:console";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { emptyStatistic } from "@allurereport/core-api";
import type { Plugin, PluginContext, PluginSummary } from "@allurereport/plugin-api";
import MetricsPlugin from "@allurereport/plugin-metrics";
import { KnownError } from "@allurereport/service";
import { feature, story } from "allure-js-commons";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { resolveConfig } from "../src/config.js";
import { FileSystemReportFiles, InMemoryReportFiles } from "../src/plugin.js";
import { AllureReport } from "../src/report.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename) };
});

let output: string;
const inventory = async () => JSON.parse(await readFile(join(output, ".allure-output.json"), "utf8"));
const summary = (): PluginSummary => ({ name: "Report", stats: emptyStatistic(), status: "passed", duration: 0 });
const plugin = (id: string, done: (context: PluginContext) => Promise<void>, info?: Plugin["info"]) => ({
  id,
  enabled: true,
  options: {},
  plugin: { done, info } satisfies Plugin,
});
const writeReport = async (context: PluginContext) => {
  await context.reportFiles.addFile("index.html", Buffer.from(context.id));
  await context.reportFiles.addFile("chunks/viewer.js", Buffer.from("viewer"));
};
beforeEach(async () => {
  await feature("report-output-ownership");
  await story("core-finalization");
  output = await mkdtemp(join(tmpdir(), "allure-report-ownership-"));
});
afterEach(async () => {
  vi.mocked(fs.rename).mockReset();
  vi.restoreAllMocks();
  await rm(output, { recursive: true, force: true });
});

it("records single report files at their final paths and leaves upload keys and history URLs unchanged", async () => {
  const config = await resolveConfig({
    output,
    name: "Report",
    appendHistory: true,
    historyPath: join(output, "history.jsonl"),
    historyBaseUrl: "https://example.test/run",
  });
  let context: PluginContext;
  config.plugins = [
    plugin(
      "awesome",
      async (ctx) => {
        context = ctx;
        await writeReport(ctx);
      },
      async () => summary(),
    ),
  ];
  const report = new AllureReport(config);
  await report.start();
  await report.done();
  const result = await inventory();
  expect(result.layout).toEqual({ awesome: "" });
  expect(result.files).toContainEqual({ path: "index.html", pluginId: "awesome" });
  expect(result.files).toContainEqual({ path: "chunks/viewer.js", pluginId: "awesome" });
  expect(result.files).toContainEqual({ path: "test-results.json" });
  expect(
    result.files.some((file: { path: string }) => file.path.includes("history") || file.path === ".allure-output.json"),
  ).toBe(false);
  for (const file of result.files) await expect(readFile(join(output, file.path))).resolves.toBeInstanceOf(Buffer);
  expect(Object.keys(await context!.state.get("files"))).toEqual(["index.html", "chunks/viewer.js", "summary.json"]);
  expect(JSON.parse((await readFile(join(output, "history.jsonl"), "utf8")).trim()).url).toBe(
    "https://example.test/run/index.html",
  );
});

it("records multi-report root summary and ignores disabled/no-output plugins and direct exports", async () => {
  const config = await resolveConfig({ output, name: "Report", appendHistory: false });
  const disabled = plugin("disabled", writeReport);
  disabled.enabled = false;
  config.plugins = [
    plugin("one", writeReport, async () => summary()),
    plugin("two", writeReport, async () => summary()),
    disabled,
    plugin("empty", async () => {}),
    { id: "metrics", enabled: true, options: {}, plugin: new MetricsPlugin() },
  ];
  const report = new AllureReport(config);
  await report.start();
  await report.done();
  const result = await inventory();
  expect(result.layout).toEqual({ one: "one", two: "two" });
  expect(result.files).toContainEqual({ path: "index.html" });
  expect(result.files).toContainEqual({ path: "one/chunks/viewer.js", pluginId: "one" });
  expect(
    result.files.some((file: { path: string }) => file.path.startsWith("export/") || file.path.includes("disabled")),
  ).toBe(false);
  expect(await readdir(join(output, "export"))).toContain("prometheusData.txt");
});

it("does not adopt user files or change placement next to foreign directories", async () => {
  await mkdir(join(output, "user"));
  await writeFile(join(output, "user", "keep.txt"), "keep");
  const config = await resolveConfig({ output, appendHistory: false });
  config.plugins = [plugin("awesome", writeReport)];
  const report = new AllureReport(config);
  await report.start();
  await report.done();
  const result = await inventory();
  expect(result.layout).toEqual({ awesome: "awesome" });
  expect(result.files.some((file: { path: string }) => file.path.startsWith("user/"))).toBe(false);
  expect(await readFile(join(output, "user", "keep.txt"), "utf8")).toBe("keep");
});

it.each(["start", "done", "info"] as const)(
  "preserves the previous inventory after a swallowed %s error",
  async (hook) => {
    const previous = JSON.stringify({ version: 1, files: [], layout: {} });
    await writeFile(join(output, ".allure-output.json"), previous);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const config = await resolveConfig({ output, appendHistory: false });
    config.plugins = [
      {
        id: "broken",
        enabled: true,
        options: {},
        plugin: {
          done: writeReport,
          [hook]: async () => {
            throw new Error("plugin failed");
          },
        },
      },
    ];
    const report = new AllureReport(config);
    await report.start();
    await report.done();
    expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe(previous);
  },
);

it("preserves prior metadata if flattening fails", async () => {
  const previous = JSON.stringify({ version: 1, files: [], layout: {} });
  await writeFile(join(output, ".allure-output.json"), previous);
  await writeFile(join(output, "chunks"), "user file");
  const config = await resolveConfig({ output, appendHistory: false });
  config.plugins = [plugin("awesome", writeReport)];
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const source = join(output, "awesome", "chunks");
  const target = join(output, "chunks");
  // Inject the failure at the flattening boundary; rename collision behavior varies by OS.
  vi.mocked(fs.rename).mockImplementation(async (from, to) => {
    if (from === source && to === target) throw new Error("flattening failed");
    return actual.rename(from, to);
  });
  const report = new AllureReport(config);
  await report.start();
  await expect(report.done()).rejects.toThrow("flattening failed");
  expect(fs.rename).toHaveBeenCalledWith(source, target);
  expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe(previous);
  expect(await readFile(join(output, "chunks"), "utf8")).toBe("user file");
});

it.each(["custom", "custom-subclass", "different-root", "live", "dump"] as const)(
  "does not add ownership metadata in %s mode",
  async (mode) => {
    const previous = JSON.stringify({ version: 1, files: [], layout: {} });
    await writeFile(join(output, ".allure-output.json"), previous);
    const config = await resolveConfig({
      output,
      appendHistory: false,
      ...(mode === "dump" ? { dump: join(output, "state") } : {}),
    });
    if (mode === "custom") config.reportFiles = new InMemoryReportFiles();
    if (mode === "custom-subclass") {
      class CustomWriter extends FileSystemReportFiles {
        override addFile = async (path: string) => path;
      }
      config.reportFiles = new CustomWriter(output);
    }
    if (mode === "different-root") config.reportFiles = new FileSystemReportFiles(join(output, "alternate"));
    if (mode === "live") config.realTime = true;
    config.plugins = [plugin("awesome", writeReport)];
    const report = new AllureReport(config);
    await report.start();
    await report.done();
    expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe(previous);
  },
);

it("accumulates ownership across generations without deleting old files or changing legacy placement", async () => {
  const firstConfig = await resolveConfig({ output, appendHistory: false });
  firstConfig.plugins = [plugin("awesome", writeReport)];
  const first = new AllureReport(firstConfig);
  await first.start();
  await first.done();
  await writeFile(join(output, "user.txt"), "user");
  const nextConfig = await resolveConfig({ output, appendHistory: false });
  nextConfig.plugins = [
    plugin("awesome", async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("new report"));
      await context.reportFiles.addFile("new.js", Buffer.from("new"));
    }),
  ];
  const next = new AllureReport(nextConfig);
  await next.start();
  await next.done();
  const result = await inventory();
  expect(result.layout).toEqual({ awesome: "awesome" });
  expect(result.files).toContainEqual({ path: "index.html", pluginId: "awesome" });
  expect(result.files).toContainEqual({ path: "chunks/viewer.js", pluginId: "awesome" });
  expect(result.files).toContainEqual({ path: "awesome/new.js", pluginId: "awesome" });
  expect(result.files.some((file: { path: string }) => file.path === "user.txt")).toBe(false);
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("awesome");
  expect(await readFile(join(output, "awesome/index.html"), "utf8")).toBe("new report");
  expect(await readFile(join(output, "chunks/viewer.js"), "utf8")).toBe("viewer");
});

it("records only tracked files when a plugin writes outside ReportFiles", async () => {
  const config = await resolveConfig({ output, appendHistory: false });
  config.plugins = [
    plugin("awesome", async (context) => {
      await writeReport(context);
      await writeFile(join(context.output, "outside.txt"), "direct write");
    }),
  ];
  const report = new AllureReport(config);
  await report.start();
  await report.done();
  expect((await inventory()).files.some((file: { path: string }) => file.path === "outside.txt")).toBe(false);
  expect(await readFile(join(output, "outside.txt"), "utf8")).toBe("direct write");
});

it("records a summary-only plugin without inventing an HTML entry point", async () => {
  const config = await resolveConfig({ output, appendHistory: false });
  config.plugins = [
    plugin(
      "summary-only",
      async () => {},
      async () => summary(),
    ),
  ];
  const report = new AllureReport(config);
  await report.start();
  await report.done();
  const result = await inventory();
  expect(result.layout).toEqual({ "summary-only": "" });
  expect(result.files).toContainEqual({ path: "summary.json", pluginId: "summary-only" });
  expect(result.files.some((file: { path: string }) => file.path === "index.html")).toBe(false);
  await expect(readFile(join(output, "index.html"))).rejects.toThrow();
});

it("preserves legacy plugin metadata files instead of overwriting them with the inventory", async () => {
  const previous = JSON.stringify({ version: 1, files: [], layout: {} });
  await writeFile(join(output, ".allure-output.json"), previous);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const config = await resolveConfig({ output, appendHistory: false });
  config.plugins = [
    plugin("awesome", async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("report"));
      await context.reportFiles.addFile(".allure-output.json", Buffer.from("plugin"));
    }),
  ];
  const report = new AllureReport(config);
  await report.start();
  await report.done();
  expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe("plugin");
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("report");
});

it("generates a report when the inventory path is occupied by a user file", async () => {
  await writeFile(join(output, ".allure-output.json"), "user content");
  const config = await resolveConfig({ output, appendHistory: false });
  config.plugins = [plugin("awesome", writeReport)];
  const report = new AllureReport(config);
  await report.start();
  await report.done();
  expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe("user content");
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("awesome");
  await expect(readFile(join(output, ".allure-output.lock"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("releases the lock if startup throws before a plugin can run", async () => {
  const config = await resolveConfig({ output, appendHistory: false });
  config.plugins = [plugin("awesome", writeReport)];
  const report = new AllureReport(config);
  vi.spyOn(report.store, "updateHistoryFlags").mockImplementationOnce(() => {
    throw new Error("startup failed");
  });
  await expect(report.start()).rejects.toThrow("startup failed");
  const next = new AllureReport(config);
  await next.start();
  await next.done();
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("awesome");
});

it("does not reserve output while reports are only reading results", async () => {
  const firstConfig = await resolveConfig({ output, appendHistory: false });
  const nextConfig = await resolveConfig({ output, appendHistory: false });
  firstConfig.plugins = [plugin("awesome", writeReport)];
  nextConfig.plugins = [plugin("awesome", writeReport)];
  const first = new AllureReport(firstConfig),
    next = new AllureReport(nextConfig);
  await first.start();
  await next.start();
  expect(await readdir(output)).toEqual([]);
  await first.done();
  await next.done();
  expect((await inventory()).files).toContainEqual({ path: "index.html", pluginId: "awesome" });
});

it("rejects concurrent finalization before the second plugin writes any output", async () => {
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const firstConfig = await resolveConfig({ output, appendHistory: false });
  firstConfig.plugins = [
    plugin("awesome", async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("first"));
      entered();
      await gate;
    }),
  ];
  const secondConfig = await resolveConfig({ output, appendHistory: false });
  const secondWrite = vi.fn(writeReport);
  secondConfig.plugins = [plugin("awesome", secondWrite)];
  const first = new AllureReport(firstConfig),
    second = new AllureReport(secondConfig);
  await first.start();
  await second.start();
  const completing = first.done();
  await started;
  try {
    await expect(second.done()).rejects.toThrow("Report output is locked");
    expect(secondWrite).not.toHaveBeenCalled();
  } finally {
    release();
    await completing;
  }
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("first");
});

it("preserves the previous inventory when appending history fails without failing done", async () => {
  const previous = JSON.stringify({ version: 1, files: [], layout: {} });
  await writeFile(join(output, ".allure-output.json"), previous);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const config = await resolveConfig({ output, appendHistory: true, historyPath: join(output, "history.jsonl") });
  config.plugins = [plugin("awesome", writeReport)];
  const report = new AllureReport(config);
  vi.spyOn(report.store, "appendHistory").mockRejectedValueOnce(new KnownError("history unavailable"));
  await report.start();
  await expect(report.done()).resolves.toBeUndefined();
  expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe(previous);
});
