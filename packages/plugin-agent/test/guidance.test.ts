import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { story } from "allure-js-commons";
import { beforeEach, describe, it } from "vitest";

import { renderAgentsGuide } from "../src/guidance.js";
import { expectTextToContainAll } from "./evidence.js";

beforeEach(async () => {
  await story("guidance");
});

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("allure agent-mode guidance", () => {
  it("should keep stable guidance in the package README and generated run playbook", async () => {
    const readme = await readFile(join(repoRoot, "packages", "plugin-agent", "README.md"), "utf-8");
    const agentsGuide = renderAgentsGuide();

    await expectTextToContainAll("generated AGENTS guide", agentsGuide, [
      "## Reading Order",
      "## Command Task Map",
      "## Agent Workflows",
      "Use the smallest workflow that matches the task.",
      "### Validate A Change",
      "### Add Or Update Tests",
      "### Review Existing Coverage",
      "### Review Existing Evidence",
      "### Triage Failures",
      "### Rerun A Prior Scope",
      "### Improve Evidence Quality",
      "### Recover Or Diagnose Agent Mode",
      "allure agent --goal <text> --expect-tests <count> --expect-test",
      "allure agent inspect <allure-results-dir-or-glob>",
      "allure agent inspect --dump <archive-or-glob>",
      "allure agent latest",
      "allure agent state-dir",
      "allure agent query --latest summary|tests|findings|test",
      "allure agent select --latest",
      "allure agent --rerun-latest",
      "--preset review|failed|unsuccessful|all",
      "--environment <id>",
      "--label name=value",
      "--rerun-environment",
      "--rerun-label",
      "ALLURE_AGENT_STATE_DIR",
      "manifest/run.json",
      "manifest/test-events.jsonl",
    ]);

    await expectTextToContainAll("plugin-agent README", readme, [
      "## Verification Standard",
      "## CLI Capability Workflow",
      "allure --version",
      "allure agent capabilities --json",
      "allure agent --help",
      "allure agent query --help",
      "allure agent select --help",
      "allure agent latest --help",
      "allure agent state-dir --help",
      "`allure agent capabilities --json` is the structured local contract for agents.",
      "`allure agent --help` includes the human-readable command task map",
      '--expect-test "<fullName>"',
      "instead of spending context reconstructing runner-specific test names",
      "instead of manually rebuilding runner-specific test names",
      "analyze existing Allure results or dump archives downloaded from CI",
      "For small mechanical test changes, use a scoped agent-mode run for the smoke check",
      "treat the review as partial",
      "Use `allure --version`, `allure agent capabilities --json`, and `allure agent --help` before choosing flags",
    ]);
  });
});
