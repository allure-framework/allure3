import type { Config, PluginDescriptor } from "@allurereport/plugin-api";
import * as console from "node:console";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import * as process from "node:process";
import type { FullConfig, PluginInstance } from "./api.js";
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
  name?: Config["name"];
  output?: Config["output"];
  historyPath?: Config["historyPath"];
  knownIssuesPath?: Config["knownIssuesPath"];
  plugins?: Config["plugins"];
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
    "allureService",
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
  const known = await readKnownIssues(knownIssuesPath);
  const variables = config.variables ?? {};
  const environments = config.environments ?? {};
  const plugins =
    Object.keys(override?.plugins ?? config?.plugins ?? {}).length === 0
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
    historyPath,
    knownIssuesPath,
    known,
    variables,
    environments,
    appendHistory,
    reportFiles: new FileSystemReportFiles(output),
    plugins: pluginInstances,
    qualityGate: config.qualityGate,
    allureService: config.allureService,
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

/**
 * Returns the plugin instance that matches the given predicate
 * If there are more than one instance that matches the predicate, returns the first one
 * @param config
 * @param predicate
 */
export const getPluginInstance = (config: FullConfig, predicate: (plugin: PluginInstance) => boolean) => {
  return config?.plugins?.find(predicate);
};

/**
 * Enforces the plugin instance in the config
 * If the plugin instance is not present, it will be added to the config as a single plugin in it
 * If the plugin instance is already present, it will be used as a single plugin in it
 * @param config
 * @param pluginInstance
 */
export const enforcePlugin = (config: FullConfig, pluginInstance: PluginInstance) => {
  const newConfig = { ...config };
  const instance = getPluginInstance(
    newConfig,
    (item) => item.plugin.constructor === pluginInstance.plugin.constructor,
  );

  if (!instance) {
    newConfig.plugins = [pluginInstance];
  } else {
    newConfig.plugins = [instance];
  }

  return newConfig;
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
    const pluginId = getPluginId(id);
    const Plugin = await resolvePlugin(pluginConfig.import ?? id);

    pluginInstances.push({
      id: pluginId,
      enabled: pluginConfig.enabled ?? true,
      options: pluginConfig.options ?? {},
      plugin: new Plugin(pluginConfig.options),
    });
  }

  return pluginInstances;
};
