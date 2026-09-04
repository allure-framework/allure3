import type { CiDescriptor } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyCiOverrides } from "../src/utils/ciOverrides.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("ciOverrides");
  await label("coverage", "testops-integration");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const baseCi = {
  type: "github",
  jobUid: "detected-job-uid",
  jobUrl: "https://ci.example.com/job",
  jobName: "detected-job-name",
  jobRunUid: "detected-run-uid",
  jobRunUrl: "https://ci.example.com/job/run",
  jobRunName: "detected-run-name",
  jobRunBranch: "detected-branch",
} as unknown as CiDescriptor;

describe("applyCiOverrides", () => {
  it("returns the descriptor unchanged when no override env vars are set", () => {
    expect(applyCiOverrides(baseCi)).toEqual(baseCi);
  });

  it("overrides jobUid from ALLURE_JOB_UID", () => {
    vi.stubEnv("ALLURE_JOB_UID", "manual-job-uid");

    expect(applyCiOverrides(baseCi)).toEqual({ ...baseCi, jobUid: "manual-job-uid" });
  });

  it("overrides every supported field independently", () => {
    vi.stubEnv("ALLURE_JOB_UID", "manual-job-uid");
    vi.stubEnv("ALLURE_JOB_URL", "https://manual.example.com/job");
    vi.stubEnv("ALLURE_JOB_NAME", "manual-job-name");
    vi.stubEnv("ALLURE_JOB_RUN_UID", "manual-run-uid");
    vi.stubEnv("ALLURE_JOB_RUN_URL", "https://manual.example.com/run");
    vi.stubEnv("ALLURE_JOB_RUN_NAME", "manual-run-name");
    vi.stubEnv("ALLURE_JOB_RUN_BRANCH", "manual-branch");

    expect(applyCiOverrides(baseCi)).toEqual({
      ...baseCi,
      jobUid: "manual-job-uid",
      jobUrl: "https://manual.example.com/job",
      jobName: "manual-job-name",
      jobRunUid: "manual-run-uid",
      jobRunUrl: "https://manual.example.com/run",
      jobRunName: "manual-run-name",
      jobRunBranch: "manual-branch",
    });
  });

  it("leaves fields without a matching env var untouched", () => {
    vi.stubEnv("ALLURE_JOB_NAME", "manual-job-name");

    const result = applyCiOverrides(baseCi);

    expect(result.jobName).toBe("manual-job-name");
    expect(result.jobUid).toBe(baseCi.jobUid);
    expect(result.jobRunUid).toBe(baseCi.jobRunUid);
  });

  it("ignores empty-string overrides", () => {
    vi.stubEnv("ALLURE_JOB_UID", "");

    expect(applyCiOverrides(baseCi)).toEqual(baseCi);
  });
});
