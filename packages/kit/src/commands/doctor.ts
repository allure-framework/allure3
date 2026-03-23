import * as console from "node:console";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { cwd as processCwd } from "node:process";

import { Command, Option } from "clipanion";

import { findExistingConfig, readAllureConfig } from "../utils/config-io.js";
import { detectFrameworks, detectInstalledAllurePackages } from "../utils/detect-frameworks.js";
import { detectPackageManager } from "../utils/detect-package-manager.js";
import { findReportPluginById, FRAMEWORK_REGISTRY } from "../utils/registry.js";
import { logError, logHint, logInfo, logNewLine, logStep, logSuccess, logWarning } from "../utils/ui.js";

const moduleExists = async (moduleName: string, cwd: string): Promise<boolean> => {
  try {
    const modulePath = resolve(cwd, "node_modules", moduleName);

    await access(modulePath);

    return true;
  } catch {
    return false;
  }
};

export class DoctorCommand extends Command {
  static paths = [["doctor"]];

  static usage = Command.Usage({
    description: "Diagnose your Allure 3 configuration",
    examples: [["doctor", "Run all diagnostic checks"]],
  });

  cwd = Option.String("--cwd", {
    description: "Working directory (default: current directory)",
  });

  async execute() {
    const workingDir = this.cwd ?? processCwd();
    let issuesFound = 0;

    console.log("\n  Allure Doctor\n");

    logStep("Checking environment...");

    const packageManager = await detectPackageManager(workingDir);

    logSuccess(`Package manager: ${packageManager}`);

    logStep("Checking config file...");

    const existingConfig = await findExistingConfig(workingDir);

    if (!existingConfig) {
      logError("No allurerc config file found");
      logHint("Run 'allure-kit init' to create one");
      issuesFound++;
    } else {
      logSuccess(`Config found: ${existingConfig.path} (${existingConfig.format})`);

      const config = await readAllureConfig(workingDir);

      if (config) {
        const pluginCount = Object.keys(config.plugins ?? {}).length;

        if (pluginCount === 0) {
          logWarning("No plugins configured (the 'awesome' plugin will be used by default)");
        } else {
          logSuccess(`${pluginCount} plugin(s) configured`);
        }

        if (config.output) {
          logInfo(`Output directory: ${config.output}`);
        }
      } else if (existingConfig.format === "mjs") {
        logInfo("ESM config detected — skipping content validation (dynamic imports are not analyzed)");
      }
    }

    logStep("Checking test framework adapters...");

    const detectedFrameworks = await detectFrameworks(workingDir);

    if (detectedFrameworks.length === 0) {
      logWarning("No test frameworks detected in package.json");
    } else {
      for (const { framework } of detectedFrameworks) {
        const adapterInstalled = await moduleExists(framework.adapterPackage, workingDir);

        if (adapterInstalled) {
          logSuccess(`${framework.displayName} → ${framework.adapterPackage} installed`);
        } else {
          logError(`${framework.displayName} detected but ${framework.adapterPackage} is not installed`);
          logHint(`Run: allure-kit init or install ${framework.adapterPackage} manually`);
          issuesFound++;
        }
      }
    }

    logStep("Checking Allure CLI...");

    const allureCliInstalled = await moduleExists("allure", workingDir);

    if (allureCliInstalled) {
      logSuccess("allure CLI package is installed");
    } else {
      logError("allure CLI package is not installed");
      logHint("Run: allure-kit init");
      issuesFound++;
    }

    logStep("Checking installed plugin packages...");

    const config = await readAllureConfig(workingDir);

    if (config?.plugins) {
      for (const pluginId of Object.keys(config.plugins)) {
        const pluginDescriptor = findReportPluginById(pluginId);
        const packageName = pluginDescriptor?.packageName ?? `@allurereport/plugin-${pluginId}`;
        const isInstalled = await moduleExists(packageName, workingDir);

        if (isInstalled) {
          logSuccess(`Plugin package ${packageName} is installed`);
        } else {
          logWarning(`Plugin "${pluginId}" is in config but ${packageName} may not be installed`);
          logHint("The allure CLI bundles built-in plugins, so this might be fine");
        }
      }
    }

    logStep("Checking for unused adapters...");

    const allurePackages = await detectInstalledAllurePackages(workingDir);
    const adapterPackages = allurePackages.filter((pkg) =>
      FRAMEWORK_REGISTRY.some((framework) => framework.adapterPackage === pkg.name),
    );

    for (const adapterPkg of adapterPackages) {
      const matchingFramework = FRAMEWORK_REGISTRY.find((framework) => framework.adapterPackage === adapterPkg.name);

      if (matchingFramework) {
        const frameworkDetected = detectedFrameworks.some((detected) => detected.framework.id === matchingFramework.id);

        if (!frameworkDetected) {
          logWarning(
            `${adapterPkg.name} is installed but ${matchingFramework.packageName} was not found in dependencies`,
          );
        }
      }
    }

    logNewLine();

    if (issuesFound === 0) {
      logSuccess("No issues found. Your Allure setup looks good!");
    } else {
      logWarning(`Found ${issuesFound} issue(s). See above for details.`);
    }

    logNewLine();
  }
}
