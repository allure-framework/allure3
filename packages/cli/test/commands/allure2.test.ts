import { AllureReport, readConfig } from "@allurereport/core";
import Allure2Plugin from "@allurereport/plugin-allure2";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassicLegacyCommandAction } from "../../src/commands/allure2.js";

vi.mock("@allurereport/core", async (importOriginal) => {
  const { AllureReportMock } = await import("../utils.js");
  return {
    ...(await importOriginal()),
    readConfig: vi.fn(),
    AllureReport: AllureReportMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("allure2 command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    const resultsDir = "foo/bar/allure-results";

    (readConfig as Mock).mockResolvedValueOnce({});

    await ClassicLegacyCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "allure2",
            enabled: true,
            options: expect.objectContaining({}),
            plugin: expect.any(Allure2Plugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    const resultsDir = "foo/bar/allure-results";

    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-allure2-plugin",
          enabled: true,
          options: {
            reportLanguage: "en",
            singleFile: true,
          },
          plugin: new Allure2Plugin({
            reportLanguage: "en",
            singleFile: true,
          }),
        },
      ],
    });

    await ClassicLegacyCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-allure2-plugin",
            enabled: true,
            options: expect.objectContaining({
              reportLanguage: "en",
              singleFile: true,
            }),
            plugin: expect.any(Allure2Plugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const fixtures = {
      resultsDir: "foo/bar/allure-results",
      reportName: "Custom Allure2 Report",
      output: "./custom/output/path",
      reportLanguage: "en",
      singleFile: true,
      config: "./custom/allurerc.mjs",
    };

    await ClassicLegacyCommandAction(fixtures.resultsDir, {
      reportName: fixtures.reportName,
      output: fixtures.output,
      reportLanguage: fixtures.reportLanguage,
      singleFile: fixtures.singleFile,
      config: fixtures.config,
    });

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), fixtures.config, {
      name: fixtures.reportName,
      output: fixtures.output,
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "allure2",
            enabled: true,
            options: expect.objectContaining({
              reportLanguage: fixtures.reportLanguage,
              singleFile: fixtures.singleFile,
            }),
            plugin: expect.any(Allure2Plugin),
          }),
        ]),
      }),
    );
  });
});
