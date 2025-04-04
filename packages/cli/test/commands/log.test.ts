import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureReportMock } from "../utils.js";

const core = await import("@allurereport/core");
const { LogCommandAction } = await import("../../src/commands/log.js");

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

describe("log command", () => {
  it("should initialize allure report with a correct default plugin options", async () => {
    const resultsDir = "foo/bar/allure-results";

    await LogCommandAction(resultsDir, {});

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      plugins: expect.objectContaining({
        "@allurereport/plugin-log": {
          options: {
            groupBy: undefined,
            allSteps: undefined,
            withTrace: undefined,
          },
        },
      }),
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Allure Report",
        history: [],
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "plugin-log",
            enabled: true,
            options: {
              groupBy: undefined,
              allSteps: undefined,
              withTrace: undefined,
            },
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with a provided plugin options", async () => {
    const fixtures = {
      resultsDir: "foo/bar/allure-results",
      allSteps: true,
      withTrace: true,
      groupBy: "none",
    };

    await LogCommandAction(fixtures.resultsDir, {
      allSteps: fixtures.allSteps,
      withTrace: fixtures.withTrace,
      groupBy: fixtures.groupBy as "none",
    });

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      plugins: expect.objectContaining({
        "@allurereport/plugin-log": {
          options: {
            groupBy: fixtures.groupBy,
            allSteps: fixtures.allSteps,
            withTrace: fixtures.withTrace,
          },
        },
      }),
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [],
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "plugin-log",
            enabled: true,
            options: {
              groupBy: fixtures.groupBy,
              allSteps: fixtures.allSteps,
              withTrace: fixtures.withTrace,
            },
          }),
        ]),
      }),
    );
  });
});
