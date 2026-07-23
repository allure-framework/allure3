import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { AllureStore } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readKnownIssues, readQuarantine, writeKnownIssues, writeQuarantine } from "../src/known.js";

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
});

describe("readQuarantine", () => {
  it("should return empty array when file is missing", async () => {
    await expect(readQuarantine(join(tmpdir(), "missing-quarantine.json"))).resolves.toEqual([]);
  });
});

describe("writeKnownIssues", () => {
  let previousCwd: string;

  beforeEach(() => {
    previousCwd = process.cwd();
  });

  afterEach(async () => {
    process.chdir(previousCwd);
  });

  it("should write filtered issues to resolved path with trailing newline", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-known-"));
    const knownIssuesPath = join("known", "issues.json");
    const resolvedPath = resolve(cwd, knownIssuesPath);
    const store = {
      allTestResults: async () => [
        {
          status: "failed",
          historyId: "history-1",
          links: [{ type: "issue", url: "https://example.org/1" }],
        },
        {
          status: "broken",
          historyId: "history-2",
          links: [{ type: "link", url: "https://example.org/ignore" }],
        },
        {
          status: "passed",
          historyId: "history-3",
          links: [{ type: "issue", url: "https://example.org/ignore" }],
        },
      ],
    } as unknown as AllureStore;

    process.chdir(cwd);

    try {
      await writeKnownIssues(store, knownIssuesPath);

      await expect(readFile(resolvedPath, "utf-8")).resolves.toBe(
        `${JSON.stringify([
          {
            historyId: "history-1",
            issues: [{ type: "issue", url: "https://example.org/1" }],
            comment: "automatically generated from failure by allure known-issue command",
          },
          {
            historyId: "history-2",
            issues: [],
            comment: "automatically generated from failure by allure known-issue command",
          },
        ])}\n`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("should ignore empty path", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-known-empty-"));
    const store = {
      allTestResults: async () => [],
    } as unknown as AllureStore;

    process.chdir(cwd);

    try {
      await expect(writeKnownIssues(store, "")).resolves.toBeUndefined();
      await expect(readFile(join(cwd, "known.json"), "utf-8")).rejects.toThrow();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("writeQuarantine", () => {
  let previousCwd: string;

  beforeEach(() => {
    previousCwd = process.cwd();
  });

  afterEach(async () => {
    process.chdir(previousCwd);
  });

  it("should write quarantine issues to exact file path with trailing newline", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-quarantine-"));
    const quarantinePath = join("known", "quarantine.json");
    const resolvedPath = resolve(cwd, quarantinePath);
    const store = {
      quarantineIssues: async () => [
        {
          historyId: "history-1",
          error: { message: "boom" },
        },
      ],
    } as unknown as AllureStore;

    process.chdir(cwd);

    try {
      await writeQuarantine(store, quarantinePath);

      await expect(readFile(resolvedPath, "utf-8")).resolves.toBe(
        `${JSON.stringify([
          {
            historyId: "history-1",
            error: { message: "boom" },
          },
        ])}\n`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("should ignore empty path", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-quarantine-empty-"));
    const store = {
      quarantineIssues: async () => [],
    } as unknown as AllureStore;

    process.chdir(cwd);

    try {
      await expect(writeQuarantine(store, "")).resolves.toBeUndefined();
      await expect(readFile(join(cwd, "quarantine.json"), "utf-8")).rejects.toThrow();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
