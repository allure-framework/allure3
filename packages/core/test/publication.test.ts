import console from "node:console";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Plugin, PluginContext, PluginSummary } from "@allurereport/plugin-api";
import { createPluginSummary } from "@allurereport/plugin-api";
import { step } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveConfig } from "../src/config.js";
import { AllureReport } from "../src/report.js";
import { AllureServiceClientMock } from "./utils.js";

vi.mock("@allurereport/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/service")>()),
  AllureServiceClient: (await import("./utils.js")).AllureServiceClientMock,
}));
vi.mock("@allurereport/ci", () => ({ detect: () => undefined }));

const tempDirs: string[] = [];
const summary = async (output: string, pluginId = ""): Promise<PluginSummary> =>
  JSON.parse(await readFile(join(output, pluginId, "summary.json"), "utf8"));

const plugin = (id: string, overrides: Partial<Plugin> = {}) => ({
  id,
  enabled: true,
  options: { publish: true },
  plugin: {
    info: (context, store) => createPluginSummary({ name: context.id, plugin: context.id, store, meta: {} }),
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
    expect((await summary(output, "csv")).published).toBe(true);
    expect((await summary(output, "second")).published).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
    for (const [request] of AllureServiceClientMock.prototype.uploadReport.mock.calls) {
      if (request.pluginId && request.files["summary.json"]) {
        const uploaded = JSON.parse(await readFile(request.files["summary.json"], "utf8"));
        expect(uploaded.published).toBe(true);
      }
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

    expect((await summary(output, "healthy")).published).toBe(true);
    expect(AllureServiceClientMock.prototype.uploadReport).not.toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: "failed" }),
    );
    expect(AllureServiceClientMock.prototype.completeReport).toHaveBeenCalledTimes(1);
    if (stage === "done") {
      expect((await summary(output, "failed")).published).toBe(false);
      expect(console.warn).toHaveBeenCalledWith("- failed");
    } else {
      await expect(summary(output, "failed")).rejects.toMatchObject({ code: "ENOENT" });
      expect(console.warn).not.toHaveBeenCalled();
    }
  });

  it("does not publish a report with only the automatically generated summary", async () => {
    const { config, output } = await setup();
    config.plugins = [plugin("missing", { done: undefined })];
    await complete(config);

    expect((await summary(output)).published).toBe(false);
    expect(AllureServiceClientMock.prototype.createReport).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("- missing");
  });

  it("keeps publication working without a summary and emits no summary-based warnings", async () => {
    const { config, output } = await setup();
    config.plugins = [plugin("csv", { info: undefined })];
    await complete(config);

    expect(await readFile(join(output, "report.csv"), "utf8")).toBe("report");
    await expect(summary(output)).rejects.toMatchObject({ code: "ENOENT" });
    expect(AllureServiceClientMock.prototype.completeReport).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("warns without a client and omits publication status for local or disabled reports", async () => {
    const { config, output } = await setup(false);
    config.plugins = [
      plugin("generated"),
      { ...plugin("disabled"), enabled: false },
      { ...plugin("local"), options: {} },
    ];
    await complete(config);

    expect((await summary(output, "generated")).published).toBe(false);
    expect(await summary(output, "local")).not.toHaveProperty("published");
    await expect(summary(output, "disabled")).rejects.toMatchObject({ code: "ENOENT" });
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith("- generated");
    expect(AllureServiceClientMock).not.toHaveBeenCalled();
  });

  it.each(["create", "upload", "complete"] as const)(
    "marks the whole batch unpublished and restores links after %s fails",
    async (stage) => {
      const { config, output } = await setup();
      config.plugins = [plugin("one"), plugin("two")];
      const failure = new Error("secret network failure details");
      if (stage === "create") {
        AllureServiceClientMock.prototype.createReport.mockRejectedValueOnce(failure);
      } else {
        AllureServiceClientMock.prototype.uploadReport.mockResolvedValue({
          hrefs: {},
          indexHref: "https://report/one",
        });
        if (stage === "upload") {
          AllureServiceClientMock.prototype.uploadReport
            .mockResolvedValueOnce({ hrefs: {}, indexHref: "https://report/one" })
            .mockRejectedValueOnce(failure);
        } else {
          AllureServiceClientMock.prototype.completeReport.mockRejectedValueOnce(failure);
        }
      }
      await step("finish without changing the run outcome after a remote failure", () => complete(config));

      for (const id of ["one", "two"]) {
        const result = await summary(output, id);
        expect(result.published).toBe(false);
        expect(result.remoteHref).toBeUndefined();
        expect(JSON.stringify(result)).not.toContain("secret");
      }
      expect(AllureServiceClientMock.prototype.deleteReport).toHaveBeenCalledTimes(stage === "create" ? 0 : 1);
      expect(console.info).not.toHaveBeenCalledWith("Next reports have been published:");
      expect(console.warn).toHaveBeenCalledTimes(3);
    },
  );

  it("replaces publication status after flattening on a subsequent local run", async () => {
    const { config, output } = await setup(false);
    config.plugins = [plugin("csv")];
    await complete(config);
    expect((await summary(output)).published).toBe(false);

    const nextConfig = await resolveConfig({ name: "Publication", output });
    nextConfig.plugins = [{ ...plugin("csv"), options: {} }];
    await complete(nextConfig);
    expect(await summary(output)).not.toHaveProperty("published");
  });

  it.each(["realtime", "dump"] as const)("omits publication status and warnings in %s mode", async (mode) => {
    const { config, output } = await setup(false);
    config.plugins = [plugin("csv")];
    if (mode === "realtime") config.realTime = true;
    else config.dump = join(output, "dump.zip");
    await complete(config);

    if (mode === "realtime") expect(await summary(output)).not.toHaveProperty("published");
    else await expect(summary(output)).rejects.toMatchObject({ code: "ENOENT" });
    expect(console.warn).not.toHaveBeenCalled();
  });
});
