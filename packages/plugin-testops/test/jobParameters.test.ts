import type { CiDescriptor } from "@allurereport/core-api";
import { CiType } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { externalParameters } from "../src/utils/jobParameters.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("jobParameters");
  await label("coverage", "testops-integration");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("externalParameters", () => {
  it("sends the current branch as the job's default Branch parameter even when the job already has a stale one", () => {
    const currentRunCi = { type: CiType.Github, jobRunBranch: "feature/x" } as unknown as CiDescriptor;
    const staleJobParameters = [{ name: "Branch", defaultValue: "main" }];

    const { job } = externalParameters(currentRunCi, staleJobParameters);

    expect(job).toContainEqual({ name: "Branch", defaultValue: "feature/x" });
  });

  it("preserves an existing job parameter that the current run doesn't touch", () => {
    const currentRunCi = { type: CiType.Github, jobRunBranch: "feature/x" } as unknown as CiDescriptor;
    const staleJobParameters = [{ name: "Owner", defaultValue: "someone" }];

    const { job } = externalParameters(currentRunCi, staleJobParameters);

    expect(job).toContainEqual({ name: "Owner", defaultValue: "someone" });
  });
});
