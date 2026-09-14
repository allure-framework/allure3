import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { AgentUsageError } from "../src/errors.js";
import { assertExplicitAgentOutputDirIsSafe } from "../src/output-dir.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agent-output-dir");
  await label("coverage", "agent-mode");
});

describe("explicit agent output dir safety", () => {
  it("allows an absent directory", async () => {
    await expect(
      assertExplicitAgentOutputDirIsSafe(join(tmpdir(), `allure-agent-absent-${process.pid}`)),
    ).resolves.toBeUndefined();
  });

  it("allows an empty directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-empty-"));

    try {
      await expect(assertExplicitAgentOutputDirIsSafe(dir)).resolves.toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a non-empty directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-nonempty-"));
    writeFileSync(join(dir, "keep.txt"), "x");

    try {
      await expect(assertExplicitAgentOutputDirIsSafe(dir)).rejects.toBeInstanceOf(AgentUsageError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a path that is a file, not a directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "allure-agent-file-"));
    const filePath = join(dir, "f.txt");
    writeFileSync(filePath, "x");

    try {
      await expect(assertExplicitAgentOutputDirIsSafe(filePath)).rejects.toThrow(/not a directory/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
