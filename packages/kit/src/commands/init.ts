import * as console from "node:console";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd as processCwd } from "node:process";

import { Command, Option } from "clipanion";
import prompts from "prompts";

import { buildAllureConfig } from "../templates/allurerc.js";
import { getDemoTestPath, getDemoTestTemplate } from "../templates/demo-tests.js";
import type { ConfigFormat } from "../utils/config-io.js";
import { findExistingConfig, writeAllureConfig } from "../utils/config-io.js";
import type { DetectedFramework } from "../utils/detect-frameworks.js";
import { detectFrameworks } from "../utils/detect-frameworks.js";
import { detectPackageManager, getInstallCommand } from "../utils/detect-package-manager.js";
import { executeCommand } from "../utils/exec.js";
import { FRAMEWORK_REGISTRY, REPORT_PLUGIN_REGISTRY } from "../utils/registry.js";
import { logError, logHint, logInfo, logNewLine, logStep, logSuccess, logWarning } from "../utils/ui.js";

const sourceLabel = (source: DetectedFramework["source"]): string => {
  switch (source) {
    case "dependencies":
    case "devDependencies":
      return `package.json ${source}`;
    case "config-file":
      return "config file found";
    case "test-files":
      return "test files found";
  }
};

export class InitCommand extends Command {
  static paths = [["init"]];

  static usage = Command.Usage({
    description: "Initialize Allure 3 in your project",
    details:
      "Detects test frameworks (by dependencies, config files, and existing tests), installs adapters, creates an allurerc config, and optionally generates demo tests showcasing all Allure features.",
    examples: [
      ["init", "Interactive setup with auto-detection"],
      ["init --format json", "Use JSON config format"],
      ["init --yes", "Accept all defaults without prompts"],
      ["init --demo", "Also generate demo tests"],
    ],
  });

  format = Option.String("--format,-f", {
    description: "Config file format: json, yaml, or mjs (default: json)",
  });

  yes = Option.Boolean("--yes,-y", false, {
    description: "Accept all defaults without prompts",
  });

  demo = Option.Boolean("--demo", false, {
    description: "Generate demo tests showcasing all Allure features",
  });

  cwd = Option.String("--cwd", {
    description: "Working directory (default: current directory)",
  });

  async execute() {
    const workingDir = this.cwd ?? processCwd();

    console.log("\n  Allure 3 Setup\n");

    const existingConfig = await findExistingConfig(workingDir);

    if (existingConfig) {
      logWarning(`Config file already exists: ${existingConfig.path}`);

      if (!this.yes) {
        const { shouldOverwrite } = await prompts({
          type: "confirm",
          name: "shouldOverwrite",
          message: "Overwrite existing config?",
          initial: false,
        });

        if (!shouldOverwrite) {
          logInfo("Setup cancelled.");
          return;
        }
      }
    }

    logStep("Detecting project configuration...");

    const packageManager = await detectPackageManager(workingDir);

    logSuccess(`Package manager: ${packageManager}`);

    const detectedFrameworks = await detectFrameworks(workingDir);

    if (detectedFrameworks.length > 0) {
      logSuccess("Detected test frameworks:");

      for (const { framework, source, version } of detectedFrameworks) {
        const versionStr = version !== "unknown" ? ` (${version})` : "";

        logHint(`${framework.displayName}${versionStr} — ${sourceLabel(source)}`);
      }
    } else {
      logWarning("No test frameworks detected");
      logHint("Checked: package.json dependencies, config files, and test file patterns");
    }

    let selectedFrameworkIds: string[];
    let selectedPluginIds: string[];
    let configFormat: ConfigFormat = (this.format as ConfigFormat) ?? "json";
    let reportName = "Allure Report";
    let shouldGenerateDemo = this.demo;

    if (this.yes) {
      selectedFrameworkIds = detectedFrameworks.map(({ framework }) => framework.id);
      selectedPluginIds = REPORT_PLUGIN_REGISTRY.filter((plugin) => plugin.isDefault).map((plugin) => plugin.id);
    } else {
      let frameworkChoices = detectedFrameworks.map(({ framework, source, version }) => ({
        title: `${framework.displayName} → ${framework.adapterPackage}${version !== "unknown" ? ` (${version})` : ""} [${sourceLabel(source)}]`,
        value: framework.id,
        selected: true,
      }));

      const detectedIds = new Set(detectedFrameworks.map((d) => d.framework.id));
      const undetected = FRAMEWORK_REGISTRY.filter((f) => !detectedIds.has(f.id));

      if (undetected.length > 0) {
        frameworkChoices = [
          ...frameworkChoices,
          ...undetected.map((framework) => ({
            title: `${framework.displayName} → ${framework.adapterPackage}`,
            value: framework.id,
            selected: false,
          })),
        ];
      }

      const frameworkResponse = await prompts({
        type: "multiselect",
        name: "frameworks",
        message: "Select frameworks to integrate",
        choices: frameworkChoices,
        hint: "- Space to toggle. Return to submit",
      });

      selectedFrameworkIds = frameworkResponse.frameworks ?? [];

      const pluginChoices = REPORT_PLUGIN_REGISTRY.map((plugin) => ({
        title: `${plugin.id} — ${plugin.description}`,
        value: plugin.id,
        selected: plugin.isDefault,
      }));

      const pluginResponse = await prompts({
        type: "multiselect",
        name: "plugins",
        message: "Select report plugins",
        choices: pluginChoices,
        hint: "- Space to toggle. Return to submit",
      });

      selectedPluginIds = pluginResponse.plugins ?? ["awesome"];

      if (!this.format) {
        const formatResponse = await prompts({
          type: "select",
          name: "format",
          message: "Config file format",
          choices: [
            { title: "JSON (allurerc.json) — easy to edit programmatically", value: "json" },
            { title: "YAML (allurerc.yaml) — human-friendly", value: "yaml" },
            { title: "ESM (allurerc.mjs) — supports functions and imports", value: "mjs" },
          ],
          initial: 0,
        });

        configFormat = formatResponse.format ?? "json";
      }

      const nameResponse = await prompts({
        type: "text",
        name: "reportName",
        message: "Report name",
        initial: "Allure Report",
      });

      reportName = nameResponse.reportName ?? "Allure Report";

      if (!this.demo && selectedFrameworkIds.length > 0) {
        const demoResponse = await prompts({
          type: "confirm",
          name: "generateDemo",
          message: "Generate demo tests showcasing all Allure features?",
          initial: true,
        });

        shouldGenerateDemo = demoResponse.generateDemo ?? false;
      }
    }

    const packagesToInstall: string[] = ["allure"];

    const selectedAdapters = selectedFrameworkIds
      .map((id) => FRAMEWORK_REGISTRY.find((f) => f.id === id))
      .filter(Boolean)
      .map((f) => f!.adapterPackage);

    packagesToInstall.push(...selectedAdapters);

    if (shouldGenerateDemo) {
      const needsAllureCommons = selectedFrameworkIds.some(
        (id) => id !== "cypress" && id !== "cucumberjs" && id !== "codeceptjs",
      );

      if (needsAllureCommons && !packagesToInstall.includes("allure-js-commons")) {
        packagesToInstall.push("allure-js-commons");
      }
    }

    if (packagesToInstall.length > 0) {
      logStep("Installing packages...");

      const installCommand = getInstallCommand(packageManager, packagesToInstall, true);

      logInfo(installCommand);

      const result = await executeCommand(installCommand, workingDir);

      if (result.exitCode !== 0) {
        logError("Package installation failed:");
        console.log(result.stderr);
        return;
      }

      logSuccess("Packages installed successfully");
    }

    logStep("Creating config file...");

    const config = buildAllureConfig(reportName, selectedPluginIds);
    const createdFilename = await writeAllureConfig(workingDir, config, configFormat);

    logSuccess(`Created ${createdFilename}`);

    if (shouldGenerateDemo && selectedFrameworkIds.length > 0) {
      logStep("Generating demo tests...");

      for (const frameworkId of selectedFrameworkIds) {
        const template = getDemoTestTemplate(frameworkId);

        if (!template) {
          continue;
        }

        const testDir = getDemoTestPath(frameworkId);
        const fullDir = join(workingDir, testDir);

        if (!existsSync(fullDir)) {
          mkdirSync(fullDir, { recursive: true });
        }

        const filePath = join(fullDir, template.filename);

        if (existsSync(filePath)) {
          logWarning(`Skipped ${join(testDir, template.filename)} (already exists)`);
          continue;
        }

        await writeFile(filePath, template.content, "utf-8");
        logSuccess(`Created ${join(testDir, template.filename)}`);
      }

      logHint("Demo tests showcase: labels, steps, attachments, parameters, links");
    }

    const selectedFrameworks = selectedFrameworkIds
      .map((id) => FRAMEWORK_REGISTRY.find((f) => f.id === id))
      .filter(Boolean);

    if (selectedFrameworks.length > 0) {
      logStep("Next steps — configure your test framework:");
      logNewLine();

      for (const framework of selectedFrameworks) {
        logInfo(`${framework!.displayName}:`);
        logHint(framework!.setupHint);
        logNewLine();
      }
    }

    logStep("You're all set! Run your tests and generate a report:");
    logHint("npx allure generate");
    logHint("npx allure run -- <your-test-command>");
    logNewLine();
  }
}
