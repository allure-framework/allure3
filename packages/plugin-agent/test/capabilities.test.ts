import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { AGENT_TASK_MAP_HELP, createAgentCapabilities, isAgentTaskMapHelpRequest } from "../src/capabilities.js";
import { attachJsonEvidence, expectTextToContainAll } from "./evidence.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agent-capabilities");
  await label("coverage", "agent-mode");
});

describe("agent capabilities", () => {
  it("should describe the supported local agent command surface", async () => {
    const payload = createAgentCapabilities();

    await attachJsonEvidence("agent capabilities payload", payload);
    expect(payload.schema).toBe("allure-agent-capabilities/v1");
    expect(payload.commands.run.supported).toBe(true);
    expect(payload.commands.run.usage).toContain("-- <command>");
    expect(payload.commands.run.options).not.toContain("--dump");
    expect(payload.commands.run.options).toContain("--report");
    expect(payload.commands.inspect.usage).toContain("allure agent inspect");
    expect(payload.commands.inspect.options).toContain("--dump");
    expect(payload.commands.inspect.options).toContain("--config");
    expect(payload.commands.inspect.options).toContain("--output");
    expect(payload.commands.inspect.options).toContain("--report");
    expect(payload.commands.inspect.options).toContain("--report-name");
    expect(payload.commands.inspect.options).toContain("--history-limit");
    expect(payload.commands.inspect.options).toContain("--hide-labels");
    expect(payload.commands.run.options).toContain("--expect-test");
    expect(payload.commands.latest.output).toEqual(["agent output: <dir>", "agent index: <dir>/index.md"]);
    expect(payload.commands.select.output).toEqual(["stdout-testplan-json", "file-testplan-json", "file-summary"]);
    expect(payload.commands.select.presets).toEqual(["review", "failed", "unsuccessful", "all"]);
    expect(payload.commands.query.supported).toBe(true);
    expect(payload.commands.query.views).toEqual(["summary", "tests", "findings", "test"]);
    expect(payload.commands.query.filters).toContain("status");
    expect(payload.expectations.inline.expected.fullNames).toBe(true);
    expect(payload.expectations.inline.forbidden.labels).toBe(true);
    expect(payload.expectations.inline.forbidden.fullNames).toBe(false);
    expect(payload.expectations.inline.evidence.stepNameContains).toBe(true);
    expect(payload.expectations.inline.evidence.attachmentFilters).toEqual(["name", "content-type"]);
    expect(payload.commands.run.options).not.toContain("--expect-evidence");
    expect(payload.output.files).toContain("manifest/run.json");
    expect(payload.output.files).toContain("manifest/human-report.json");
    expect(payload.output.files).toContain("awesome/index.html");
    expect(payload.humanReports.option).toBe("--report <auto|off|awesome|config>");
    expect(payload.humanReports.defaultMode).toBe("auto");
    expect(payload.humanReports.threshold).toEqual({
      resultCount: 1000,
      appliesTo: "auto",
      countSource: "Allure store visible logical test results with retries excluded",
      generatedWhen: "<= 1000",
      skippedWhen: "> 1000",
    });
    expect(payload.humanReports.statusManifest).toBe("manifest/human-report.json");
    expect(payload.humanReports.defaultGeneratedPath).toBe("awesome/index.html");
    expect(payload.humanReports.discovery).toEqual(
      expect.arrayContaining([
        expect.stringContaining("When a user asks for a human-readable report after an agent run"),
        expect.stringContaining("Read `<output>/manifest/human-report.json`"),
        expect.stringContaining("If the status is `generated`, use `<output>/<path>`"),
      ]),
    );
    expect(payload.unsupported.discovery).toBe(true);
    expect(payload.unsupported).not.toHaveProperty("query");
    expect(payload.unsupported.localAgentService).toBe(true);
  });

  it("should define the task-map help request and help content", async () => {
    const helpRequestCases = [
      { args: ["agent", "--help"], expected: true },
      { args: ["agent", "-h"], expected: true },
      { args: ["agent", "-h=3"], expected: false },
      { args: ["agent", "latest", "--help"], expected: false },
    ];

    await attachJsonEvidence("task map help request cases", helpRequestCases);
    expect(helpRequestCases.map(({ args }) => isAgentTaskMapHelpRequest(args))).toEqual(
      helpRequestCases.map(({ expected }) => expected),
    );
    await expectTextToContainAll("agent task map help", AGENT_TASK_MAP_HELP, [
      "Agent task map:",
      "allure agent capabilities",
      "allure agent --goal ... -- <command>",
      "allure agent inspect --dump <archive-or-glob>",
      "allure agent query --from <output-dir> tests",
      "allure agent select --from <output-dir>",
      "Human reports:",
      "When a user asks for \"the report\" after a run",
      "<output>/manifest/human-report.json",
      "<output>/awesome/index.html",
      "ALLURE_AGENT_STATE_DIR=<dir>",
    ]);
  });
});
