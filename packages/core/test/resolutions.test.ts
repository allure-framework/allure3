import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import {
  getResolutionByRules,
  isIgnoredFailure,
  resolveExactIssuesFilePath,
  validateResolutionsConfig,
  writeKnownIssues,
} from "../src/resolutions.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("resolutions");
  await story("core");
  await label("coverage", "resolutions");
});

const config = {
  links: { jira: { nameTemplate: "Jira %s", urlTemplate: "https://jira.example/browse/%s" } },
  rules: [
    {
      id: "checkout-defect",
      category: "issue" as const,
      issue: { id: "SHOP-42", type: "jira" },
      testCaseId: ["tc-1", "tc-2"],
      environment: ["prod", "staging"],
    },
  ],
};

describe("resolution rules", () => {
  it("matches array values with AND between matcher fields", () => {
    const result = {
      status: "failed",
      environment: "prod",
      testCase: { id: "tc-2" },
      error: { message: "boom" },
    } as any;

    expect(getResolutionByRules(result, config)).toBe(config.rules[0]);
    expect(getResolutionByRules({ ...result, environment: "dev" }, config)).toBeUndefined();
  });

  it("does not classify successful results", () => {
    expect(getResolutionByRules({ status: "passed", testCase: { id: "tc-1" } } as any, config)).toBeUndefined();
  });

  it("ignores only muted and accepted failures", () => {
    expect(isIgnoredFailure({ resolution: "issue" } as any)).toBe(false);
    expect(isIgnoredFailure({ resolution: "muted" } as any)).toBe(true);
    expect(isIgnoredFailure({ resolution: "accepted" } as any)).toBe(true);
  });
});

describe("resolution config validation", () => {
  it("accepts a valid issue rule", () => {
    expect(() => validateResolutionsConfig(config)).not.toThrow();
  });

  it("requires comments for muted and accepted rules", () => {
    expect(() =>
      validateResolutionsConfig({ rules: [{ category: "muted", comment: "", retryHash: ["hash"] }] }),
    ).toThrow(/comment must be a non-empty string/);
  });

  it("requires issue link type to exist", () => {
    expect(() => validateResolutionsConfig({ ...config, links: {} })).toThrow(/must reference resolutions.links/);
  });

  it("rejects empty matcher arrays and invalid regular expressions", () => {
    expect(() =>
      validateResolutionsConfig({
        rules: [{ category: "accepted", comment: "expected", retryHash: [], messageRegexp: "[" }],
      }),
    ).toThrow(/non-empty array.*valid regular expression/);
  });
});

describe("known issues snapshot", () => {
  it("writes only current non-retry issue failures keyed by retry hash", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-known-write-"));
    const path = join(cwd, "known.json");
    const resolutionIssue = { id: "checkout-defect", issue: { id: "SHOP-42", type: "jira" } };
    const issueResult = {
      id: "tr-1",
      name: "checkout",
      fullName: "shop > checkout",
      environment: "prod",
      status: "failed",
      error: { message: "boom" },
      retryHash: "retry-1",
      resolution: "issue",
      isRetry: false,
    };
    const store = {
      allTestResults: async () => [issueResult, { ...issueResult, id: "tr-2", resolution: "muted" }],
      resolutionIssueByTestResultId: async (id: string) => (id === "tr-1" ? resolutionIssue : undefined),
    };

    try {
      await writeKnownIssues(store as never, path);
      await expect(readFile(path, "utf-8")).resolves.toBe(
        `${JSON.stringify({
          resolutionIssues: [
            {
              ...resolutionIssue,
              testResults: {
                "retry-1": {
                  name: "checkout",
                  fullName: "shop > checkout",
                  environment: "prod",
                  status: "failed",
                  error: { message: "boom" },
                },
              },
            },
          ],
        })}\n`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("validates exact json paths", async () => {
    await expect(resolveExactIssuesFilePath(undefined, "known issues")).resolves.toBeUndefined();
    await expect(resolveExactIssuesFilePath("known.txt", "known issues")).rejects.toThrow(/exact \.json/);
  });
});
