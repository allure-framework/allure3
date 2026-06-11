import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { formatAgentOutputLinks, resolveAgentIndexPath } from "../src/paths.js";

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
