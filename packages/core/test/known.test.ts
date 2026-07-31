import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { readKnownIssues } from "../src/known.js";

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
