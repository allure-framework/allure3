import { resolve } from "node:path";

import { AllureReport, type FullConfig, readRawConfig, resolveConfig } from "@allurereport/core";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { glob } from "glob";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { TestPlanCommand } from "../../src/commands/testplan.js";
import { AllureReportMock } from "../utils.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  output: "custom-output/muted.json",
  config: {
    name: "Test plan",
    output: resolve("."),
    open: false,
    port: undefined,
    reportFiles: { addFile: vi.fn().mockResolvedValue("testplan.json") },
    plugins: [],
  } satisfies FullConfig,
};

vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    readRawConfig: vi.fn(),
    resolveConfig: vi.fn(),
    AllureReport: AllureReportMock,
  };
});
vi.mock("glob", () => ({ glob: vi.fn() }));

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("testplan");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
  vi.mocked(readRawConfig).mockResolvedValue({});
  vi.mocked(resolveConfig).mockResolvedValue(fixtures.config);
  vi.mocked(glob).mockResolvedValue([`${fixtures.resultsDir}/`]);
});

describe("testplan command", () => {
  it("should generate a test plan with default plugin options", async () => {
    await run(TestPlanCommand, ["testplan", fixtures.resultsDir]);

    expect(resolveConfig).toHaveBeenCalledWith({
      output: resolve("."),
      plugins: {
        "@allurereport/plugin-testplan": {
          options: { fileName: "testplan.json", mutedOnly: false },
        },
      },
    });
    expect(AllureReport).toHaveBeenCalledWith(fixtures.config);
    expect(AllureReportMock.prototype.start).toHaveBeenCalledOnce();
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith(`${fixtures.resultsDir}/`);
    expect(AllureReportMock.prototype.done).toHaveBeenCalledOnce();
  });

  it("should generate a muted-only test plan with the requested output", async () => {
    await run(TestPlanCommand, ["testplan", fixtures.resultsDir, "--muted-only", "--output", fixtures.output]);

    expect(resolveConfig).toHaveBeenCalledWith({
      output: resolve("custom-output"),
      plugins: {
        "@allurereport/plugin-testplan": {
          options: { fileName: "muted.json", mutedOnly: true },
        },
      },
    });
    expect(AllureReport).toHaveBeenCalledWith(fixtures.config);
    expect(AllureReportMock.prototype.start).toHaveBeenCalledOnce();
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith(`${fixtures.resultsDir}/`);
    expect(AllureReportMock.prototype.done).toHaveBeenCalledOnce();
  });
});
