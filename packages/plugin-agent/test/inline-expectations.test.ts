import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentExpectationUsageError, AgentUsageError } from "../src/errors.js";
import { buildAgentInlineExpectations, validateAgentExpectationsFile } from "../src/inline-expectations.js";

let tempDir: string | undefined;

const makeTempDir = async () => {
  tempDir = await mkdtemp(join(tmpdir(), "allure-agent-expectations-test-"));

  return tempDir;
};

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("inline-expectations");
  await label("coverage", "agent-mode");
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("inline agent expectations", () => {
  it.each([
    {
      option: "--goal",
      input: { goal: "Review agent visibility" },
      expected: { goal: "Review agent visibility" },
    },
    {
      option: "--task-id",
      input: { taskId: "agent-inline" },
      expected: { task_id: "agent-inline" },
    },
    {
      option: "--expect-tests",
      input: { expectTests: "2" },
      expected: { expected: { test_count: 2 } },
    },
    {
      option: "--expect-label",
      input: { expectLabels: ["module=plugin-agent", "module=cli"] },
      expected: { expected: { label_values: { module: ["plugin-agent", "cli"] } } },
    },
    {
      option: "--expect-env",
      input: { expectEnvironments: ["node"] },
      expected: { expected: { environments: ["node"] } },
    },
    {
      option: "--expect-test",
      input: { expectFullNames: ["suite should pass"] },
      expected: { expected: { full_names: ["suite should pass"] } },
    },
    {
      option: "--expect-prefix",
      input: { expectPrefixes: ["suite"] },
      expected: { expected: { full_name_prefixes: ["suite"] } },
    },
    {
      option: "--forbid-label",
      input: { forbidLabels: ["layer=e2e"] },
      expected: { forbidden: { label_values: { layer: ["e2e"] } } },
    },
    {
      option: "--expect-step-containing",
      input: { expectStepContains: ["assert expected behavior"] },
      expected: { evidence: { step_name_contains: ["assert expected behavior"] } },
    },
    {
      option: "--expect-steps",
      input: { expectSteps: "1" },
      expected: { evidence: { min_steps: 1 } },
    },
    {
      option: "--expect-attachments",
      input: { expectAttachments: "1" },
      expected: { evidence: { min_attachments: 1 } },
    },
    {
      option: "--expect-attachment name",
      input: { expectAttachmentFilters: ["trace.zip"] },
      expected: { evidence: { attachments: [{ name: "trace.zip" }] } },
    },
    {
      option: "--expect-attachment name=...",
      input: { expectAttachmentFilters: ["name=trace.zip"] },
      expected: { evidence: { attachments: [{ name: "trace.zip" }] } },
    },
    {
      option: "--expect-attachment content-type=...",
      input: { expectAttachmentFilters: ["content-type=application/json"] },
      expected: { evidence: { attachments: [{ content_type: "application/json" }] } },
    },
    {
      option: "--expect-attachment type=...",
      input: { expectAttachmentFilters: ["type=image/png"] },
      expected: { evidence: { attachments: [{ content_type: "image/png" }] } },
    },
  ])("should parse $option", ({ input, expected }) => {
    expect(buildAgentInlineExpectations(input)).toEqual(expected);
  });

  it("should parse combined inline expectations", () => {
    expect(
      buildAgentInlineExpectations({
        goal: "Review agent visibility",
        taskId: "agent-inline",
        expectTests: "2",
        expectLabels: ["module=plugin-agent"],
        expectEnvironments: ["node"],
        expectFullNames: ["suite should pass"],
        expectPrefixes: ["suite"],
        forbidLabels: ["layer=e2e"],
        expectStepContains: ["assert expected behavior"],
        expectSteps: "1",
        expectAttachments: "1",
        expectAttachmentFilters: ["trace.zip", "content-type=application/json"],
      }),
    ).toEqual({
      goal: "Review agent visibility",
      task_id: "agent-inline",
      expected: {
        test_count: 2,
        environments: ["node"],
        full_names: ["suite should pass"],
        full_name_prefixes: ["suite"],
        label_values: {
          module: ["plugin-agent"],
        },
      },
      forbidden: {
        label_values: {
          layer: ["e2e"],
        },
      },
      evidence: {
        min_steps: 1,
        min_attachments: 1,
        step_name_contains: ["assert expected behavior"],
        attachments: [{ name: "trace.zip" }, { content_type: "application/json" }],
      },
    });
  });

  it.each([
    { option: "--expect-tests", input: { expectTests: "-1" } },
    { option: "--expect-tests non-integer", input: { expectTests: "1.5" } },
    { option: "--expect-tests empty", input: { expectTests: "   " } },
    { option: "--expect-steps", input: { expectSteps: "1.5" } },
    { option: "--expect-steps zero", input: { expectSteps: "0" } },
    { option: "--expect-attachments", input: { expectAttachments: "many" } },
    { option: "--expect-attachments zero", input: { expectAttachments: "0" } },
    { option: "--expect-label", input: { expectLabels: ["module"] } },
    { option: "--expect-label colon", input: { expectLabels: ["module:cli"] } },
    { option: "--forbid-label", input: { forbidLabels: ["layer"] } },
    { option: "--expect-attachment", input: { expectAttachmentFilters: ["extension=zip"] } },
    { option: "--expect-attachment empty", input: { expectAttachmentFilters: ["   "] } },
  ])("should reject invalid $option", ({ input }) => {
    expect(() => buildAgentInlineExpectations(input)).toThrow(AgentExpectationUsageError);
  });

  it.each([
    { option: "--goal", input: { goal: ["Review one", "Review two"] } },
    { option: "--task-id", input: { taskId: ["TASK-1", "TASK-2"] } },
    { option: "--expect-tests", input: { expectTests: ["1", "2"] } },
    { option: "--expect-steps", input: { expectSteps: ["1", "2"] } },
    { option: "--expect-attachments", input: { expectAttachments: ["1", "2"] } },
  ])("should reject duplicate single-value option $option", ({ input }) => {
    expect(() => buildAgentInlineExpectations(input)).toThrow(AgentExpectationUsageError);
  });

  it("should reject zero test count combined with positive scope", () => {
    expect(() =>
      buildAgentInlineExpectations({
        expectTests: "0",
        expectFullNames: ["suite should pass"],
      }),
    ).toThrow(AgentExpectationUsageError);
  });

  it("should validate expectation files and reject invalid file input", async () => {
    const cwd = await makeTempDir();

    await writeFile(join(cwd, "expected.yaml"), "goal: valid file expectations\n", "utf-8");
    await expect(validateAgentExpectationsFile({ cwd, expectations: "expected.yaml" })).resolves.toBeUndefined();

    await writeFile(join(cwd, "invalid.yaml"), "[]", "utf-8");
    await expect(validateAgentExpectationsFile({ cwd, expectations: "invalid.yaml" })).rejects.toBeInstanceOf(
      AgentExpectationUsageError,
    );
  });

  it("should reject expectation files placed inside the output directory", async () => {
    const cwd = await makeTempDir();

    await expect(
      validateAgentExpectationsFile({
        cwd,
        output: "agent-output",
        expectations: "agent-output/expected.yaml",
      }),
    ).rejects.toBeInstanceOf(AgentUsageError);
  });
});
