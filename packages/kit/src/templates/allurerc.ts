import type { AllureConfig, PluginEntry } from "../utils/config-io.js";

export const buildAllureConfig = (reportName: string, pluginIds: string[]): AllureConfig => {
  const plugins: Record<string, PluginEntry> = {};

  for (const pluginId of pluginIds) {
    plugins[pluginId] = { options: {} };
  }

  return {
    name: reportName,
    output: "./allure-report",
    plugins,
  };
};

export const PRESET_CONFIGS: Record<string, { description: string; pluginIds: string[] }> = {
  minimal: {
    description: "Basic report with the awesome plugin",
    pluginIds: ["awesome"],
  },
  full: {
    description: "Full report with awesome, dashboard, and log plugins",
    pluginIds: ["awesome", "dashboard", "log"],
  },
  ci: {
    description: "CI-optimized setup with log, dashboard, and slack",
    pluginIds: ["log", "dashboard", "slack"],
  },
};
