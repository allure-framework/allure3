import { AllureReport, readConfig } from "@allurereport/core";
import CsvPlugin from "@allurereport/plugin-csv";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { CsvCommandAction } from "../../src/commands/csv.js";

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

describe("csv command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    const resultsDir = "foo/bar/allure-results";

    (readConfig as Mock).mockResolvedValueOnce({});

    await CsvCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "csv",
            enabled: true,
            options: expect.objectContaining({}),
            plugin: expect.any(CsvPlugin),
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
          id: "my-csv-plugin",
          enabled: true,
          options: {
            separator: ";",
            disableHeaders: true,
          },
          plugin: new CsvPlugin({
            separator: ";",
            disableHeaders: true,
          }),
        },
      ],
    });

    await CsvCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-csv-plugin",
            enabled: true,
            options: expect.objectContaining({
              separator: ";",
              disableHeaders: true,
            }),
            plugin: expect.any(CsvPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const fixtures = {
      separator: ";",
      disableHeaders: true,
      resultsDir: "foo/bar/allure-results",
      config: "./custom/allurerc.mjs",
    };

    await CsvCommandAction(fixtures.resultsDir, {
      separator: fixtures.separator,
      disableHeaders: fixtures.disableHeaders,
      config: fixtures.config,
    });

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), fixtures.config, {});
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "csv",
            enabled: true,
            options: expect.objectContaining({
              separator: fixtures.separator,
              disableHeaders: fixtures.disableHeaders,
            }),
            plugin: expect.any(CsvPlugin),
          }),
        ]),
      }),
    );
  });
});
