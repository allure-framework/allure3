import console from "node:console";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Plugin, PluginContext, ReportPublication } from "@allurereport/plugin-api";
import { createPluginSummary } from "@allurereport/plugin-api";
import { step } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveConfig } from "../src/config.js";
import { AllureReport } from "../src/report.js";
import { AllureServiceClientMock } from "./utils.js";

vi.mock("@allurereport/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/service")>()),
  AllureServiceClient: (await import("./utils.js")).AllureServiceClientMock,
}));
vi.mock("@allurereport/ci", () => ({ detect: () => undefined }));

const tempDirs: string[] = [];
const publication = async (output: string): Promise<ReportPublication[]> =>
  JSON.parse(await readFile(join(output, "publication.json"), "utf8"));

const plugin = (id: string, overrides: Partial<Plugin> = {}) => ({
  id,
  enabled: true,
  options: { publish: true },
  plugin: {
    done: async (context) => {
      await context.reportFiles.addFile("report.csv", Buffer.from("report"));
    },
    ...overrides,
  } satisfies Plugin,
});

const setup = async (withClient = true) => {
  const output = await mkdtemp(join(tmpdir(), "allure-publication-"));
  tempDirs.push(output);
  const config = await resolveConfig({
    name: "Publication",
    output,
    allureService: withClient ? { accessToken: "ars1.test" } : undefined,
  });
  config.plugins = [];
  return { config, output };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  AllureServiceClientMock.prototype.uploadReport.mockResolvedValue({ hrefs: {} });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const complete = async (config: Awaited<ReturnType<typeof resolveConfig>>) => {
  const report = new AllureReport(config);
  await report.start();
  await expect(report.done()).resolves.toBeUndefined();
};

describe("report publication", () => {
  it("confirms non-HTML reports only after completion, independently of returned links", async () => {
    const { config, output } = await setup();
    config.plugins = [plugin("csv"), plugin("second")];
    await step("generate and complete the remote publication", () => complete(config));

    expect(AllureServiceClientMock.prototype.completeReport).toHaveBeenCalledTimes(1);
    expect(await publication(output)).toEqual([
      { pluginId: "csv", status: "published" },
      { pluginId: "second", status: "published" },
    ]);
    expect(console.warn).not.toHaveBeenCalled();
    for (const [request] of AllureServiceClientMock.prototype.uploadReport.mock.calls) {
      expect(request.files).not.toHaveProperty("publication.json");
    }
  });

  it.each(["start", "done"] as const)("does not upload partial files after %s fails", async (stage) => {
    const { config, output } = await setup();
    config.plugins = [
      plugin("failed", {
        [stage]: async (context: PluginContext) => {
          await context.reportFiles.addFile("partial.csv", Buffer.from("partial"));
          throw new Error("generation failure");
        },
      }),
      plugin("healthy"),
    ];
    await step("continue publication after a plugin lifecycle failure", () => complete(config));

    expect(await publication(output)).toEqual([
      { pluginId: "failed", status: "not-published", reason: "generation-failed" },
      { pluginId: "healthy", status: "published" },
    ]);
    expect(AllureServiceClientMock.prototype.uploadReport).not.toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: "failed" }),
    );
    expect(AllureServiceClientMock.prototype.completeReport).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith("- failed: Report generation failed");
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("detects absent files when a plugin provides a summary: %s", async (withSummary) => {
    const { config, output } = await setup();
    config.plugins = [
      plugin("missing", {
        done: undefined,
        info: withSummary
          ? (context, store) => createPluginSummary({ name: context.reportName, plugin: context.id, store, meta: {} })
          : undefined,
      }),
    ];
    await complete(config);

    expect(await publication(output)).toEqual([
      { pluginId: "missing", status: "not-published", reason: "no-report-files" },
    ]);
    expect(AllureServiceClientMock.prototype.createReport).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("- missing: No report files were generated");
  });

  it("uses generation and missing-file reasons before unavailable-client, and excludes unrequested reports", async () => {
    const { config, output } = await setup(false);
    config.plugins = [
      plugin("generated"),
      plugin("empty", { done: undefined }),
      plugin("failed", {
        start: async () => {
          throw new Error("start failed");
        },
      }),
      { ...plugin("disabled"), enabled: false },
      { ...plugin("local"), options: {} },
    ];
    await complete(config);

    expect(await publication(output)).toEqual([
      { pluginId: "generated", status: "not-published", reason: "publisher-unavailable" },
      { pluginId: "empty", status: "not-published", reason: "no-report-files" },
      { pluginId: "failed", status: "not-published", reason: "generation-failed" },
    ]);
    expect(console.warn).toHaveBeenCalledTimes(4);
    expect(AllureServiceClientMock).not.toHaveBeenCalled();
  });

  it.each(["create", "upload", "complete"] as const)(
    "marks the whole batch unavailable after %s fails",
    async (stage) => {
      const { config, output } = await setup();
      config.plugins = [plugin("one"), plugin("two")];
      const failure = new Error("secret network failure details");
      if (stage === "create") {
        AllureServiceClientMock.prototype.createReport.mockRejectedValueOnce(failure);
      } else if (stage === "upload") {
        AllureServiceClientMock.prototype.uploadReport
          .mockResolvedValueOnce({ hrefs: {}, indexHref: "https://report/one" })
          .mockRejectedValueOnce(failure);
      } else {
        AllureServiceClientMock.prototype.completeReport.mockRejectedValueOnce(failure);
      }
      await step("finish without changing the run outcome after a remote failure", () => complete(config));

      expect(await publication(output)).toEqual([
        { pluginId: "one", status: "not-published", reason: "publication-failed" },
        { pluginId: "two", status: "not-published", reason: "publication-failed" },
      ]);
      expect(await readFile(join(output, "publication.json"), "utf8")).not.toContain("secret");
      expect(AllureServiceClientMock.prototype.deleteReport).toHaveBeenCalledTimes(stage === "create" ? 0 : 1);
      expect(console.info).not.toHaveBeenCalledWith("Next reports have been published:");
      expect(console.warn).toHaveBeenCalledTimes(3);
    },
  );

  it("keeps the manifest at the root after flattening and clears it in the next local run", async () => {
    const { config, output } = await setup(false);
    config.plugins = [plugin("csv")];
    await complete(config);
    expect(await readFile(join(output, "report.csv"), "utf8")).toBe("report");
    expect(await publication(output)).toHaveLength(1);

    config.plugins = [{ ...plugin("csv"), options: {} }];
    await complete(config);
    expect(await publication(output)).toEqual([]);
  });

  it.each(["realtime", "dump"] as const)("does not write outcomes or warn in %s mode", async (mode) => {
    const { config, output } = await setup(false);
    config.plugins = [plugin("csv")];
    if (mode === "realtime") config.realTime = true;
    else config.dump = join(output, "dump.zip");
    await complete(config);

    await expect(readFile(join(output, "publication.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("logs a manifest write failure without failing the run", async () => {
    const { config, output } = await setup(false);
    config.plugins = [plugin("csv")];
    await mkdir(join(output, "publication.json"));
    await writeFile(join(output, "publication.json", "keep"), "keep");
    await complete(config);
    expect(console.warn).toHaveBeenCalledWith("Failed to write Allure publication results", expect.any(String));
    expect(await readFile(join(output, "publication.json", "keep"), "utf8")).toBe("keep");
  });
});
