import * as console from "node:console";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cwd as processCwd } from "node:process";

import { Command, Option } from "clipanion";
import prompts from "prompts";

import { detectPackageManager } from "./utils/detect-package-manager.js";
import { logHint, logInfo, logNewLine, logStep, logSuccess, logWarning } from "./utils/ui.js";

const WORKFLOW_FILE_RELATIVE_PATH = join(".github", "workflows", "allure-gh-pages.yml");

const getInstallCommand = (packageManager: string): string => {
  switch (packageManager) {
    case "npm":
      return "npm ci";
    case "pnpm":
      return "pnpm install --frozen-lockfile";
    case "yarn":
    default:
      return "yarn install --immutable --immutable-cache --check-cache";
  }
};

const getTestCommand = (packageManager: string): string => {
  switch (packageManager) {
    case "npm":
      return "npm test";
    case "pnpm":
      return "pnpm test";
    case "yarn":
    default:
      return "yarn test";
  }
};

const buildWorkflowYaml = (params: {
  defaultBranch: string;
  packageManager: string;
  allureConfigPath?: string;
  testCommand: string;
}): string => {
  const installCommand = getInstallCommand(params.packageManager);
  const allureConfigArgument = params.allureConfigPath ? ` --config=${params.allureConfigPath}` : "";

  return `name: Allure Report (GitHub Pages)

on:
  push:
    branches: [${params.defaultBranch}]
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: allure-gh-pages-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "20.x"
          cache: "${params.packageManager}"
      - name: Install dependencies
        run: ${installCommand}
      - name: Run tests (produce allure-results)
        run: ${params.testCommand}
      - name: Generate Allure report
        run: npx allure generate${allureConfigArgument} --output ./allure-report
      - name: Deploy to GitHub Pages (gh-pages branch)
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./allure-report
          publish_branch: gh-pages
`;
};

export class KitGhPagesInitCommand extends Command {
  static paths = [["kit", "gh-pages", "init"]];

  static usage = Command.Usage({
    description: "Initialize GitHub Pages deployment for Allure reports",
    details:
      "Creates a GitHub Actions workflow that runs your tests, generates an Allure report, and deploys it to the gh-pages branch.",
    examples: [
      ["kit gh-pages init", "Interactive setup"],
      ["kit gh-pages init --yes", "Create workflow without prompts"],
      ["kit gh-pages init --branch main", "Use custom default branch"],
      ["kit gh-pages init --config ./allurerc.mjs", "Use a specific Allure config file"],
    ],
  });

  yes = Option.Boolean("--yes,-y", false, {
    description: "Accept all defaults without prompts",
  });

  cwd = Option.String("--cwd", {
    description: "Working directory (default: current directory)",
  });

  defaultBranch = Option.String("--branch", {
    description: "Default branch to deploy from (default: main)",
  });

  allureConfig = Option.String("--config", {
    description: "Path to Allure config file to use in CI (optional)",
  });

  testCommand = Option.String("--test-command", {
    description: "Test command to run in CI (default: inferred from package manager)",
  });

  async execute() {
    const workingDir = typeof this.cwd === "string" ? this.cwd : processCwd();
    const targetWorkflowPath = resolve(workingDir, WORKFLOW_FILE_RELATIVE_PATH);

    console.log("\n  Allure GitHub Pages Setup\n");

    logStep("Preparing GitHub Pages workflow...");

    const packageManager = await detectPackageManager(workingDir);
    const defaultBranch = typeof this.defaultBranch === "string" ? this.defaultBranch : "main";
    const defaultTestCommand = getTestCommand(packageManager);
    const selectedTestCommand = typeof this.testCommand === "string" ? this.testCommand : defaultTestCommand;

    if (existsSync(targetWorkflowPath)) {
      logWarning(`Workflow already exists: ${WORKFLOW_FILE_RELATIVE_PATH}`);

      if (this.yes !== true) {
        const { shouldOverwrite } = await prompts({
          type: "confirm",
          name: "shouldOverwrite",
          message: "Overwrite existing workflow?",
          initial: false,
        });

        if (!shouldOverwrite) {
          logInfo("Setup cancelled.");
          return;
        }
      }
    }

    if (this.yes !== true) {
      const response = await prompts([
        {
          type: "text",
          name: "branch",
          message: "Deploy from branch",
          initial: defaultBranch,
        },
        {
          type: "text",
          name: "testCommand",
          message: "Test command (must produce allure-results)",
          initial: selectedTestCommand,
        },
      ]);

      const branch = (response.branch as string | undefined) ?? defaultBranch;
      const testCommand = (response.testCommand as string | undefined) ?? selectedTestCommand;

      this.defaultBranch = branch;
      this.testCommand = testCommand;
    }

    const allureConfigPath = typeof this.allureConfig === "string" ? this.allureConfig : undefined;
    const resolvedBranch = typeof this.defaultBranch === "string" ? this.defaultBranch : defaultBranch;
    const resolvedTestCommand = typeof this.testCommand === "string" ? this.testCommand : selectedTestCommand;

    const workflowYaml = buildWorkflowYaml({
      defaultBranch: resolvedBranch,
      packageManager,
      allureConfigPath,
      testCommand: resolvedTestCommand,
    });

    const workflowsDir = resolve(workingDir, ".github", "workflows");
    mkdirSync(workflowsDir, { recursive: true });

    await writeFile(targetWorkflowPath, workflowYaml, "utf-8");

    logSuccess(`Created ${WORKFLOW_FILE_RELATIVE_PATH}`);
    logNewLine();

    logStep("Next steps (GitHub repo settings):");
    logHint('Go to "Settings" → "Pages"');
    logHint('Set "Build and deployment" → "Source" to "Deploy from a branch"');
    logHint('Select branch "gh-pages" and folder "/"');
    logNewLine();

    logStep("How to use:");
    logHint("Commit and push the workflow to your repository");
    logHint("Wait for the GitHub Actions workflow to finish");
    logHint("Open your GitHub Pages URL to view the report");
    logNewLine();

    logStep("Notes:");
    logHint('If your tests do not generate "allure-results", update the workflow test command.');
    logHint('If you use a non-default Allure config, pass it via "--config".');
  }
}
