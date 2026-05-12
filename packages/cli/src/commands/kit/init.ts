import * as console from "node:console";

import { Command, Option, UsageError } from "clipanion";
import prompts from "prompts";

import { buildAllureConfig } from "./templates/allurerc.js";
import type { ConfigFormat } from "./utils/config-io.js";
import { findExistingConfig, writeAllureConfig } from "./utils/config-io.js";
import { detectFrameworks } from "./utils/detect-frameworks.js";
import { detectPackageManager, getInstallCommand } from "./utils/detect-package-manager.js";
import { executeCommand } from "./utils/exec.js";
import { FRAMEWORK_REGISTRY, REPORT_PLUGIN_REGISTRY } from "./utils/registry.js";
import { logError, logInfo, logSuccess, logWarning } from "./utils/ui.js";

const SUPPORTED_LANGUAGES = ["js", "ts"] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const isSupportedLanguage = (value: string): value is SupportedLanguage => {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
};

const findFrameworkByIdOrPackage = (value: string) => {
  const lowered = value.toLowerCase();

  return FRAMEWORK_REGISTRY.find((framework) => {
    if (framework.id === lowered) {
      return true;
    }

    if (framework.packageName === lowered) {
      return true;
    }

    return framework.detectPackageNames?.some((name) => name.toLowerCase() === lowered) ?? false;
  });
};

const cwdDefault = (): string => process.cwd();

export class KitInitCommand extends Command {
  static paths = [["kit", "init"], ["init"]];

  static usage = Command.Usage({
    description: "Initialize Allure 3 in your project",
    details:
      "Detects test frameworks (by dependencies, config files, and existing tests), installs adapters, and creates an allurerc config. Exits early if Allure is already configured.",
    examples: [
      ["init", "Interactive setup with auto-detection"],
      ["init --lang=js --framework=playwright", "Non-interactive setup for a single framework"],
      ["init --format json", "Use JSON config format"],
      ["init --yes", "Accept all defaults without prompts"],
    ],
  });

  format = Option.String("--format,-f", {
    description: "Config file format: json, yaml, or mjs (default: json)",
  });

  yes = Option.Boolean("--yes,-y", false, {
    description: "Accept all defaults without prompts",
  });

  lang = Option.String("--lang", {
    description: "Project language: js or ts (treated the same in this version)",
  });

  framework = Option.String("--framework", {
    description: "Force-select a single framework (e.g. playwright, vitest, wdio)",
  });

  cwd = Option.String("--cwd", {
    description: "Working directory (default: current directory)",
  });

  async execute() {
    const workingDir = typeof this.cwd === "string" ? this.cwd : cwdDefault();

    console.log("\n  Allure 3 Setup\n");

    if (typeof this.lang === "string" && !isSupportedLanguage(this.lang)) {
      throw new UsageError(
        `Unsupported --lang value ${JSON.stringify(this.lang)}. Only "js" and "ts" are supported in this version.`,
      );
    }

    let forcedFramework;

    if (typeof this.framework === "string") {
      forcedFramework = findFrameworkByIdOrPackage(this.framework);

      if (!forcedFramework) {
        const available = FRAMEWORK_REGISTRY.map((f) => f.id).join(", ");

        throw new UsageError(`Unknown --framework value ${JSON.stringify(this.framework)}. Available: ${available}.`);
      }
    }

    const existingConfig = await findExistingConfig(workingDir);

    if (existingConfig) {
      logSuccess(`Allure is already configured (${existingConfig.path}).`);
      logInfo('Run "allure kit doctor" to verify or "allure kit update" to upgrade.');
      return;
    }

    const packageManager = await detectPackageManager(workingDir);

    const detectedFrameworks = await detectFrameworks(workingDir);

    if (detectedFrameworks.length > 0) {
      for (const { framework, version } of detectedFrameworks) {
        const versionStr = version !== "unknown" ? ` ${version}` : "";
        const configPath = framework.configFilePatterns[0] ?? "";

        logInfo(`${framework.id}${versionStr}${configPath ? ` ${configPath}` : ""}`);
      }
    } else if (!forcedFramework) {
      logWarning("No test frameworks detected");
    }

    const nonInteractive = this.yes === true || forcedFramework !== undefined;
    let selectedFrameworkIds: string[];
    let selectedPluginIds: string[];
    let configFormat: ConfigFormat = typeof this.format === "string" ? (this.format as ConfigFormat) : "json";
    let reportName = "Allure Report";

    if (forcedFramework) {
      selectedFrameworkIds = [forcedFramework.id];
      selectedPluginIds = REPORT_PLUGIN_REGISTRY.filter((plugin) => plugin.isDefault).map((plugin) => plugin.id);
    } else if (nonInteractive) {
      selectedFrameworkIds = detectedFrameworks.map(({ framework }) => framework.id);
      selectedPluginIds = REPORT_PLUGIN_REGISTRY.filter((plugin) => plugin.isDefault).map((plugin) => plugin.id);
    } else {
      let frameworkChoices = detectedFrameworks.map(({ framework, version }) => ({
        title: `${framework.displayName} → ${framework.adapterPackage}${version !== "unknown" ? ` (${version})` : ""}`,
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

      if (typeof this.format !== "string") {
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
    }

    if (selectedFrameworkIds.length === 0 && !forcedFramework) {
      logWarning("No frameworks selected — only the Allure CLI will be installed.");
    }

    const selectedAdapters = selectedFrameworkIds
      .map((id) => FRAMEWORK_REGISTRY.find((f) => f.id === id))
      .filter(Boolean)
      .map((f) => f!.adapterPackage);

    const packagesToInstall = ["allure", ...selectedAdapters];

    if (packagesToInstall.length > 0) {
      const installCommand = getInstallCommand(packageManager, packagesToInstall, true);
      const result = await executeCommand(installCommand, workingDir);

      if (result.exitCode !== 0) {
        logError("Package installation failed:");
        console.log(result.stderr);
        return;
      }

      for (const adapter of selectedAdapters) {
        logSuccess(`added ${adapter}`);
      }
    }

    const config = buildAllureConfig(reportName, selectedPluginIds);
    const createdFilename = await writeAllureConfig(workingDir, config, configFormat);

    const verifyConfig = await findExistingConfig(workingDir);

    if (!verifyConfig) {
      logError(`Failed to write ${createdFilename}`);
      return;
    }

    logSuccess(`created ${createdFilename}`);
  }
}
