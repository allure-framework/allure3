import * as console from "node:console";
import { readFile, rm } from "node:fs/promises";
import { exit } from "node:process";

import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TestOpsPlanCommand } from "../../src/commands/testopsPlan.js";

const fixtures = {
  jobRunId: "491277",
  endpoint: "http://testops.example.com",
  token: "test-token",
  output: "./.tmp-testops-plan.json",
};

const getMock = vi.fn();

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("@allurereport/service", () => ({
  createServiceHttpClient: vi.fn(() => ({ get: getMock })),
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("testops-plan");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(fixtures.output, { force: true });
});

describe("testops-plan command", () => {
  it("should skip generation when ALLURE_JOB_RUN_ID isn't set", async () => {
    vi.stubEnv("ALLURE_JOB_RUN_ID", "");

    await run(TestOpsPlanCommand, ["testops-plan"]);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("ALLURE_JOB_RUN_ID isn't set"));
    expect(getMock).not.toHaveBeenCalled();
  });

  it("should exit with code 1 when TestOps credentials are missing", async () => {
    vi.stubEnv("ALLURE_JOB_RUN_ID", fixtures.jobRunId);
    vi.stubEnv("ALLURE_ENDPOINT", "");
    vi.stubEnv("ALLURE_TOKEN", "");

    await run(TestOpsPlanCommand, ["testops-plan"]);

    expect(exit).toHaveBeenCalledWith(1);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("should fetch the job run's test plan and write testplan.json", async () => {
    vi.stubEnv("ALLURE_JOB_RUN_ID", fixtures.jobRunId);
    vi.stubEnv("ALLURE_ENDPOINT", fixtures.endpoint);
    vi.stubEnv("ALLURE_TOKEN", fixtures.token);
    getMock.mockResolvedValueOnce([
      { id: 123, selector: "suite.spec.ts#test one" },
      { id: 456, selector: "suite.spec.ts#test two" },
    ]);

    await run(TestOpsPlanCommand, ["testops-plan", "--output", fixtures.output]);

    expect(getMock).toHaveBeenCalledWith(`/api/rs/jobrun/${fixtures.jobRunId}/plan`, {
      params: { expected: "true" },
    });

    const written = JSON.parse(await readFile(fixtures.output, "utf-8"));

    expect(written).toEqual({
      version: "1.0",
      tests: [
        { id: "123", selector: "suite.spec.ts#test one" },
        { id: "456", selector: "suite.spec.ts#test two" },
      ],
    });
  });

  it("should continue without a test plan when the TestOps request fails", async () => {
    vi.stubEnv("ALLURE_JOB_RUN_ID", fixtures.jobRunId);
    vi.stubEnv("ALLURE_ENDPOINT", fixtures.endpoint);
    vi.stubEnv("ALLURE_TOKEN", fixtures.token);
    getMock.mockRejectedValueOnce(new Error("network error"));

    await run(TestOpsPlanCommand, ["testops-plan", "--output", fixtures.output]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Could not fetch the test plan"));
    expect(exit).not.toHaveBeenCalled();
    await expect(readFile(fixtures.output, "utf-8")).rejects.toThrow();
  });

  it("should write an empty test plan when the job run has no selected tests", async () => {
    vi.stubEnv("ALLURE_JOB_RUN_ID", fixtures.jobRunId);
    vi.stubEnv("ALLURE_ENDPOINT", fixtures.endpoint);
    vi.stubEnv("ALLURE_TOKEN", fixtures.token);
    getMock.mockResolvedValueOnce([]);

    await run(TestOpsPlanCommand, ["testops-plan", "--output", fixtures.output]);

    const written = JSON.parse(await readFile(fixtures.output, "utf-8"));

    expect(written).toEqual({ version: "1.0", tests: [] });
  });
});
