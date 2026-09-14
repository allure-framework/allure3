import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentExpectationUsageError } from "../src/errors.js";
import { writeInvalidAgentExpectationOutput } from "../src/invalid-output.js";
import { attachJsonEvidence, attachTextEvidence } from "./evidence.js";

let tempDir: string | undefined;

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("invalid-agent-output");
  await label("coverage", "agent-mode");
  tempDir = await mkdtemp(join(tmpdir(), "allure-agent-invalid-output-test-"));
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("invalid expectation output", () => {
  it("should write minimal agent artifacts when expectation input is invalid", async () => {
    const outputDir = join(tempDir!, "agent-output");

    const result = await writeInvalidAgentExpectationOutput({
      outputDir,
      command: "npm test",
      error: new AgentExpectationUsageError(
        'Invalid --expect-label "module". Expected the form name=value, for example module=cli',
        "--expect-label",
      ),
    });

    const runManifest = JSON.parse(await readFile(join(outputDir, "manifest", "run.json"), "utf-8"));
    const finding = JSON.parse((await readFile(join(outputDir, "manifest", "findings.jsonl"), "utf-8")).trim());
    const tests = await readFile(join(outputDir, "manifest", "tests.jsonl"), "utf-8");
    const events = await readFile(join(outputDir, "manifest", "test-events.jsonl"), "utf-8");
    const index = await readFile(join(outputDir, "index.md"), "utf-8");

    await attachJsonEvidence("invalid expectation run manifest", runManifest);
    await attachJsonEvidence("invalid expectation finding", finding);
    await attachTextEvidence("invalid expectation empty tests manifest", tests);
    await attachTextEvidence("invalid expectation empty events manifest", events);
    await attachTextEvidence("invalid expectation index", index, "text/markdown");

    expect(result.outputDir).toBe(outputDir);
    expect(result.generatedAt).toEqual(expect.any(String));
    expect(tests).toBe("");
    expect(events).toBe("");
    expect(index).toContain("Status: unavailable");
    expect(runManifest).toEqual(
      expect.objectContaining({
        schema_version: "allure-agent-output/v1",
        phase: "done",
        command: "npm test",
        expectations_present: false,
        expectations: null,
        expectation_result: expect.objectContaining({
          status: "unavailable",
          impact: "reject",
          finding_ids: ["F0001"],
        }),
      }),
    );
    expect(finding).toEqual(
      expect.objectContaining({
        schema_version: "allure-agent-finding/v2",
        check_id: "expectations-invalid",
        instance_id: "F0001",
        severity: "high",
        impact: "reject",
        source: {
          kind: "inline-option",
          option: "--expect-label",
        },
        subject: {
          type: "run",
        },
        observed: expect.objectContaining({
          execution_skipped: true,
        }),
        check_name: "expectations-invalid",
      }),
    );
  });
});
