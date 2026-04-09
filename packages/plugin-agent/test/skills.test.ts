import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("allure agent-mode skills bundle", () => {
  it("should include the setup and feature-delivery skills with UI metadata", async () => {
    const setupSkill = await readFile(join(repoRoot, "skills", "allure-agent-mode-setup", "SKILL.md"), "utf-8");
    const setupUi = await readFile(join(repoRoot, "skills", "allure-agent-mode-setup", "agents", "openai.yaml"), "utf-8");
    const featureSkill = await readFile(join(repoRoot, "skills", "allure-agent-mode-feature-delivery", "SKILL.md"), "utf-8");
    const featureUi = await readFile(
      join(repoRoot, "skills", "allure-agent-mode-feature-delivery", "agents", "openai.yaml"),
      "utf-8",
    );

    expect(setupSkill).toContain("name: allure-agent-mode-setup");
    expect(setupSkill).toContain("docs/allure-agent-mode.md");
    expect(setupSkill).toContain("If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`.");
    expect(setupUi).toContain('display_name: "Allure Agent Setup"');
    expect(featureSkill).toContain("name: allure-agent-mode-feature-delivery");
    expect(featureSkill).toContain("ALLURE_AGENT_OUTPUT");
    expect(featureSkill).toContain("reviewing existing tests");
    expect(featureSkill).toContain("auditing coverage");
    expect(featureSkill).toContain("triaging failing suites");
    expect(featureSkill).toContain("If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`.");
    expect(featureSkill).toContain("Use `allure run` for smoke checks too, even when the change is small or mechanical.");
    expect(featureSkill).toContain("Only skip agent mode when it is impossible or when you are debugging agent mode itself.");
    expect(featureSkill).toContain("### Small Test Change Workflow");
    expect(featureSkill).toContain("### Coverage Review Workflow");
    expect(featureUi).toContain('display_name: "Allure Feature Delivery"');
  });

  it("should include the project guide and AGENTS router templates", async () => {
    const projectGuide = await readFile(join(repoRoot, "docs", "allure-agent-mode.md"), "utf-8");
    const rootAgents = await readFile(join(repoRoot, "AGENTS.md"), "utf-8");
    const templateGuide = await readFile(
      join(repoRoot, "skills", "allure-agent-mode-setup", "references", "project-guide-template.md"),
      "utf-8",
    );
    const agentsSnippet = await readFile(
      join(repoRoot, "skills", "allure-agent-mode-setup", "references", "root-agents-snippet.md"),
      "utf-8",
    );
    const readme = await readFile(join(repoRoot, "packages", "plugin-agent", "README.md"), "utf-8");

    expect(projectGuide).toContain("## Core Loops");
    expect(projectGuide).toContain("### Test Review Loop");
    expect(projectGuide).toContain("Runtime first, source second.");
    expect(projectGuide).toContain("## Verification Standard");
    expect(projectGuide).toContain("If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`.");
    expect(projectGuide).toContain("Use `allure run` for smoke checks too, even when the change is small or mechanical.");
    expect(projectGuide).toContain("Only skip agent mode when it is impossible or when you are debugging agent mode itself.");
    expect(projectGuide).toContain("### Small Test Change Workflow");
    expect(projectGuide).toContain("### Coverage Review Workflow");
    expect(projectGuide).toContain("## Acceptance Rules");
    expect(projectGuide).toContain("When Console Errors Are Not Represented As Test Results");
    expect(projectGuide).toContain("yarn allure run -- yarn workspace allure test");
    expect(projectGuide).toContain("test/commands/run.integration.test.ts");
    expect(rootAgents).toContain("docs/allure-agent-mode.md");
    expect(rootAgents).toContain("If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`.");
    expect(rootAgents).toContain("Use `allure run` for smoke checks too");
    expect(rootAgents).toContain("reasoning, review, coverage analysis, debugging, or any user-facing conclusion");
    expect(rootAgents).toContain("console-only review");
    expect(templateGuide).toContain("ALLURE_AGENT_EXPECTATIONS");
    expect(templateGuide).toContain("## Verification Standard");
    expect(templateGuide).toContain("### Test Review Loop");
    expect(templateGuide).toContain("### Small Test Change Workflow");
    expect(templateGuide).toContain("### Coverage Review Workflow");
    expect(templateGuide).toContain("Runtime first, source second.");
    expect(templateGuide).toContain("partial runtime review");
    expect(agentsSnippet).toContain("Use [Allure Agent Mode](docs/allure-agent-mode.md)");
    expect(agentsSnippet).toContain("If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`.");
    expect(agentsSnippet).toContain("Use `allure run` for smoke checks too");
    expect(agentsSnippet).toContain("reasoning, review, coverage analysis, debugging, or any user-facing conclusion");
    expect(readme).toContain("## Verification Standard");
    expect(readme).toContain("For small mechanical test changes, use a scoped agent-mode run for the smoke check");
    expect(readme).toContain("If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`.");
    expect(readme).toContain("treat the review as partial");
  });
});
