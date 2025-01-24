import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureReportMock } from "../utils.js";

const core = await import("@allurereport/core");
const { CsvCommandAction } = await import("../../src/commands/csv.js");

vi.spyOn(core, "resolveConfig");
vi.mock("@allurereport/core", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    AllureReport: AllureReportMock,
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
      plugins: {
        "@allurereport/plugin-csv": {
          options: {
            groupBy: undefined,
          },
        },
      },
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Allure Report",
        history: [],
        plugins: [
          expect.objectContaining({
            id: "plugin-csv",
            enabled: true,
            options: {
              groupBy: undefined,
            },
          }),
        ],
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
      plugins: {
        "@allurereport/plugin-csv": {
          options: {
            groupBy: undefined,
            separator: fixtures.separator,
            disableHeaders: fixtures.disableHeaders,
            output: fixtures.output,
            knownIssues: fixtures.knownIssues,
          },
        },
      },
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [],
        plugins: [
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
        ],
      }),
    );
  });
});
