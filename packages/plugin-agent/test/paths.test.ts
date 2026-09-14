import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import {
  formatAgentOutputLinks,
  formatProcessLogAttachmentName,
  isProcessLogAttachmentName,
  resolveAgentIndexPath,
  sanitizeProcessCommand,
} from "../src/paths.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agent-output-paths");
  await label("coverage", "agent-mode");
});

describe("agent output path helpers", () => {
  it("should resolve the agent index path using native path joining", () => {
    const outputDir = join("tmp", "allure-agent-123");

    expect(resolveAgentIndexPath(outputDir)).toBe(join(outputDir, "index.md"));
  });

  it("should format the output directory and index path links together", () => {
    const outputDir = join("tmp", "allure-agent-123");

    expect(formatAgentOutputLinks(outputDir)).toEqual([
      `agent output: ${outputDir}`,
      `agent index: ${join(outputDir, "index.md")}`,
    ]);
  });
});

describe("process log attachment names", () => {
  it("sanitizes entire command, including every argument", () => {
    const command = "node ./scripts/run.mjs --report-file results.json";

    expect(sanitizeProcessCommand(command)).toMatch(/^node_\._scripts_run\.mjs_--report-file_results\.json$/);
    expect(formatProcessLogAttachmentName(command, "stdout")).toBe(`${sanitizeProcessCommand(command)}.stdout.txt`);
    expect(formatProcessLogAttachmentName(command, "stderr")).toBe(`${sanitizeProcessCommand(command)}.stderr.txt`);
    expect(formatProcessLogAttachmentName(command, "stdout")).not.toContain("--stdout");
  });

  it("keeps long command log names below filesystem component limits", () => {
    const command = `node ${"x".repeat(500)}`;

    expect(sanitizeProcessCommand(command).length).toBe(180);
    expect(formatProcessLogAttachmentName(command, "stdout").length).toBeLessThan(255);
    expect(formatProcessLogAttachmentName(command, "stdout")).toMatch(/\.stdout\.txt$/);
  });

  it("allows commands that sanitize to the same readable name", () => {
    const spacedCommand = "a b";
    const underscoredCommand = "a_b";

    expect(sanitizeProcessCommand(spacedCommand)).toBe(sanitizeProcessCommand(underscoredCommand));
    expect(formatProcessLogAttachmentName(spacedCommand, "stdout")).toBe(
      formatProcessLogAttachmentName(underscoredCommand, "stdout"),
    );
    expect(sanitizeProcessCommand(spacedCommand)).toBe(sanitizeProcessCommand(spacedCommand));
  });

  it("trims leading and trailing underscores after sanitizing", () => {
    expect(sanitizeProcessCommand("___foo___")).toBe("foo");
  });

  it("preserves internal underscores", () => {
    expect(sanitizeProcessCommand("foo__bar")).toBe("foo__bar");
  });

  it("falls back to process when command has no readable chars", () => {
    expect(sanitizeProcessCommand("###")).toBe("process");
  });

  it("recognizes new and legacy process log names", () => {
    const command = "yarn test --watch";

    expect(isProcessLogAttachmentName(formatProcessLogAttachmentName(command, "stdout"), "stdout")).toBe(true);
    expect(isProcessLogAttachmentName(formatProcessLogAttachmentName(command, "stderr"), "stderr")).toBe(true);
    expect(isProcessLogAttachmentName("stdout.txt", "stdout")).toBe(true);
    expect(isProcessLogAttachmentName("stderr.txt", "stdout")).toBe(false);
  });
});
