import type { Config, PluginDescriptor } from "@allurereport/plugin-api";
import * as console from "node:console";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import * as process from "node:process";
import type { FullConfig, PluginInstance } from "./api.js";
import { readHistory } from "./history.js";
import { readKnownIssues } from "./known.js";
import { FileSystemReportFiles } from "./plugin.js";
import { importWrapper } from "./utils/module.js";
import { normalizeImportPath } from "./utils/path.js";

export const getPluginId = (key: string) => {
  return key.replace(/^@.*\//, "").replace(/[/\\]/g, "-");
};

const configNames = ["allurerc.js", "allurerc.mjs"];
const defaultConfig: Config = {};

export const findConfig = async (cwd: string, configPath?: string) => {
  if (configPath) {
    const resolved = resolve(cwd, configPath);

    try {
      const stats = await stat(resolved);

      if (stats.isFile()) {
        return resolved;
      }
    } catch (e) {
      console.error(e);
    }

    throw new Error(`invalid config path ${resolved}: not a regular file`);
  }

  for (const configName of configNames) {
    const resolved = resolve(cwd, configName);

    try {
      const stats = await stat(resolved);

      if (stats.isFile()) {
        return resolved;
      }
    } catch (ignored) {
      // ignore
    }
  }
};

export interface ConfigOverride {
  name?: string;
  output?: string;
  historyPath?: string;
  knownIssuesPath?: string;
}

/**
 * Validates the provided config
 * At this moment supports unknown fields check only
 * @example
 * ```js
 * validateConfig({ name: "Allure" }) // { valid: true }
 * validateConfig({ name: "Allure", unknownField: "value" }) // { valid: false, fields: ["unknownField"] }
 * ```
 * @param config
 */
export const validateConfig = (config: Config) => {
  const supportedFields: (keyof Config)[] = [
    "name",
    "output",
    "historyPath",
    "knownIssuesPath",
    "qualityGate",
    "plugins",
    "defaultLabels",
    "variables",
    "environments",
    "appendHistory",
  ];
  const unsupportedFields = Object.keys(config).filter((key) => !supportedFields.includes(key as keyof Config));

  return {
    valid: unsupportedFields.length === 0,
    fields: unsupportedFields,
  };
};

export const loadConfig = async (configPath: string): Promise<Config> => {
  return (await import(normalizeImportPath(configPath))).default;
};

export const resolveConfig = async (config: Config, override: ConfigOverride = {}): Promise<FullConfig> => {
  const validationResult = validateConfig(config);

  if (!validationResult.valid) {
    throw new Error(`The provided Allure config contains unsupported fields: ${validationResult.fields.join(", ")}`);
  }

  const name = override.name ?? config.name ?? "Allure Report";
  const historyPath = resolve(override.historyPath ?? config.historyPath ?? "./.allure/history.jsonl");
  const appendHistory = config.appendHistory ?? true;
  const knownIssuesPath = resolve(override.knownIssuesPath ?? config.knownIssuesPath ?? "./allure/known.json");
  const output = resolve(override.output ?? config.output ?? "./allure-report");
  const history = await readHistory(historyPath);
  const known = await readKnownIssues(knownIssuesPath);
  const variables = config.variables ?? {};
  const environments = config.environments ?? {};
  const plugins =
    Object.keys(config?.plugins ?? {}).length === 0
      ? {
          awesome: {
            options: {},
          },
        }
      : config.plugins!;
  const pluginInstances = await resolvePlugins(plugins);

  return {
    name,
    output,
    history,
    historyPath,
    knownIssuesPath,
    known,
    variables,
    environments,
    appendHistory,
    reportFiles: new FileSystemReportFiles(output),
    plugins: pluginInstances,
    qualityGate: config.qualityGate,
  };
};

export const readConfig = async (
  cwd: string = process.cwd(),
  configPath?: string,
  override?: ConfigOverride,
): Promise<FullConfig> => {
  const cfg = await findConfig(cwd, configPath);
  const config = cfg ? await loadConfig(cfg) : { ...defaultConfig };

  return await resolveConfig(config, override);
};

export const resolvePlugin = async (path: string) => {
  // try to append @allurereport/plugin- scope
  if (!path.startsWith("@allurereport/plugin-")) {
    try {
      const module = await importWrapper(`@allurereport/plugin-${path}`);

      return module.default;
    } catch (err) {}
  }

  try {
    const module = await importWrapper(path);

    return module.default;
  } catch (err) {
    throw new Error(`Cannot resolve plugin: ${path}`);
  }
};

const resolvePlugins = async (plugins: Record<string, PluginDescriptor>) => {
  const pluginInstances: PluginInstance[] = [];

  for (const id in plugins) {
    const pluginConfig = plugins[id];
    const Plugin = await resolvePlugin(pluginConfig.import ?? id);

    pluginInstances.push({
      id: getPluginId(id),
      enabled: pluginConfig.enabled ?? true,
      options: pluginConfig.options ?? {},
      plugin: new Plugin(pluginConfig.options),
    });
  }

  return pluginInstances;
};
