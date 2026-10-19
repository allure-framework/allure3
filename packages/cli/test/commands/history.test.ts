import { AllureReport, readRawConfig, resolveConfig } from "@allurereport/core";
import { run } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryCommand } from "../../src/commands/history.js";
import { resolveAndFindResultsDirs } from "../../src/utils/resultsPatterns.js";

vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    AllureReport: AllureReportMock,
    readRawConfig: vi.fn(),
    resolveConfig: vi.fn(),
  };
});
vi.mock("../../src/utils/resultsPatterns.js", () => ({
  resolveAndFindResultsDirs: vi.fn(),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  (readRawConfig as Mock).mockResolvedValue({});
  (resolveConfig as Mock).mockResolvedValue({ plugins: [] });
  (resolveAndFindResultsDirs as Mock).mockResolvedValue({
    resultDirectories: ["/tmp/allure-results"],
    patterns: ["/tmp/allure-results"],
  });
});

describe("history command", () => {
  it("should pass the CLI history URL base and disable report plugins", async () => {
    await run(HistoryCommand, [
      "history",
      "--history-path",
      "history.jsonl",
      "--history-base-url",
      "https://bucket.example/runs/42",
      "/tmp/allure-results",
    ]);

    expect(resolveConfig).toHaveBeenCalledWith(
      {
        historyPath: "history.jsonl",
        historyBaseUrl: "https://bucket.example/runs/42",
        historyLimit: undefined,
        name: "Allure Report",
        plugins: {},
      },
      { plugins: {} },
    );
    expect(AllureReport).toHaveBeenCalledWith({ plugins: [] });
  });

  it("should use historyBaseUrl from config when the CLI option is absent", async () => {
    (readRawConfig as Mock).mockResolvedValue({
      historyBaseUrl: "https://bucket.example/runs/config",
    });

    await run(HistoryCommand, ["history", "/tmp/allure-results"]);

    expect(resolveConfig).toHaveBeenCalledWith(
      {
        historyPath: "history.jsonl",
        historyBaseUrl: "https://bucket.example/runs/config",
        historyLimit: undefined,
        name: "Allure Report",
        plugins: {},
      },
      { plugins: {} },
    );
  });
});
