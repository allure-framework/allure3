import * as core from "@allurereport/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CsvCommandAction } from "../../src/commands/csv.js";

vi.spyOn(core, "resolveConfig");
vi.mock("@allurereport/core", async (importOriginal) => {
  const utils = await import("../utils.js");

  return {
    ...(await importOriginal()),
    AllureReport: utils.AllureReportMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("csv command", () => {
  it("should initialize allure report with a correct default plugin options", async () => {
    const resultsDir = "foo/bar/allure-results";

    await CsvCommandAction(resultsDir, {});

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      plugins: expect.objectContaining({
        "@allurereport/plugin-csv": {
          options: {
            groupBy: undefined,
          },
        },
      }),
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Allure Report",
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "plugin-csv",
            enabled: true,
            options: {
              groupBy: undefined,
            },
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with a provided plugin options", async () => {
    const fixtures = {
      separator: ";",
      disableHeaders: true,
      resultsDir: "foo/bar/allure-results",
      output: "./custom/output/path",
      knownIssues: "./custom/known/issues/path",
    };

    await CsvCommandAction(fixtures.resultsDir, {
      output: fixtures.output,
      knownIssues: fixtures.knownIssues,
      separator: fixtures.separator,
      disableHeaders: fixtures.disableHeaders,
    });

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      plugins: expect.objectContaining({
        "@allurereport/plugin-csv": {
          options: {
            groupBy: undefined,
            separator: fixtures.separator,
            disableHeaders: fixtures.disableHeaders,
            output: fixtures.output,
            knownIssues: fixtures.knownIssues,
          },
        },
      }),
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "plugin-csv",
            enabled: true,
            options: {
              disableHeaders: fixtures.disableHeaders,
              knownIssues: fixtures.knownIssues,
              output: fixtures.output,
              separator: fixtures.separator,
            },
          }),
        ]),
      }),
    );
  });
});
