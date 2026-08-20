import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { getKnownIssueByRules, readKnownIssues, resolveExactIssuesFilePath, writeKnownIssues } from "../src/known.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("known-issues");
  await story("known");
  await label("coverage", "known-issues");
});

describe("readKnownIssues", () => {
  it("should return empty array when file is missing", async () => {
    await expect(readKnownIssues(join(tmpdir(), "missing-known.json"))).resolves.toEqual([]);
  });

  it("should reject directory path", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-known-dir-"));
    const knownIssuesPath = join(cwd, "known.json");

    await mkdir(knownIssuesPath);

    try {
      await expect(readKnownIssues(knownIssuesPath)).rejects.toThrow(/expected file, got directory/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("should read known issues with current file shape", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-known-read-"));
    const knownIssuesPath = join(cwd, "known.json");
    const knownIssues = [
      {
        historyId: "history-1",
        reason: "tracked defect",
        links: [{ type: "issue", url: "https://example.org/1" }],
      },
    ];

    await writeFile(knownIssuesPath, JSON.stringify(knownIssues), "utf-8");

    try {
      await expect(readKnownIssues(knownIssuesPath)).resolves.toEqual(knownIssues);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("getKnownIssueByRules", () => {
  it("should match rule by message, test case, retry hash and environment", () => {
    const testResult = {
      historyId: "history-1",
      environment: "prod",
      retryHash: "retry-1",
      error: { message: "AssertionError: expected 1 to be 2", trace: "stack" },
      testCase: {
        id: "tc-1",
        allureId: "allure-1",
        externalId: "external-1",
      },
    } as any;

    expect(
      getKnownIssueByRules(testResult, {
        rules: [
          {
            messageRegexp: "AssertionError",
            testCaseId: "allure-1",
            retryHash: "retry-1",
            environmentId: "prod",
            decision: {
              reason: "tracked defect",
              links: [{ type: "issue", url: "https://example.org/1" }],
            },
          },
        ],
      }),
    ).toEqual({
      historyId: "history-1",
      reason: "tracked defect",
      links: [{ type: "issue", url: "https://example.org/1" }],
      error: testResult.error,
    });
  });

  it("should not match when historyId is missing", () => {
    expect(
      getKnownIssueByRules(
        {
          environment: "prod",
          retryHash: "retry-1",
          error: { message: "AssertionError: expected 1 to be 2" },
          testCase: { id: "tc-1" },
        } as any,
        {
          rules: [
            {
              messageRegexp: "AssertionError",
              decision: {
                reason: "tracked defect",
              },
            },
          ],
        },
      ),
    ).toBeUndefined();
  });

  it("should not match when rule environment does not match current result environment", () => {
    expect(
      getKnownIssueByRules(
        {
          historyId: "history-1",
          environment: "staging",
          retryHash: "retry-1",
          error: { message: "AssertionError: expected 1 to be 2" },
          testCase: { id: "tc-1" },
        } as any,
        {
          rules: [
            {
              messageRegexp: "AssertionError",
              environmentId: "prod",
              decision: {
                reason: "tracked defect",
              },
            },
          ],
        },
      ),
    ).toBeUndefined();
  });
});

describe("resolveExactIssuesFilePath", () => {
  it("should return undefined for missing path", async () => {
    await expect(resolveExactIssuesFilePath(undefined, "known issues")).resolves.toBeUndefined();
  });

  it("should resolve exact json file path", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-known-path-"));
    const path = join(cwd, "known.json");

    await writeFile(path, "[]", "utf-8");

    try {
      await expect(resolveExactIssuesFilePath(path, "known issues")).resolves.toBe(path);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("should reject non-json path", async () => {
    await expect(resolveExactIssuesFilePath("./known.txt", "known issues")).rejects.toThrow(
      /expected exact \.json file path/,
    );
  });
});

describe("writeKnownIssues", () => {
  it("should write canonical known issues file with newline", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-known-write-"));
    const path = join(cwd, "known.json");
    const store = {
      allKnownIssues: async () => [
        {
          historyId: "history-1",
          reason: "tracked defect",
          links: [{ type: "issue", url: "https://example.org/1" }],
        },
      ],
    } as const;

    try {
      await writeKnownIssues(store as never, path);

      await expect(readFile(path, "utf-8")).resolves.toBe(
        `${JSON.stringify([
          {
            historyId: "history-1",
            reason: "tracked defect",
            links: [{ type: "issue", url: "https://example.org/1" }],
          },
        ])}\n`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
