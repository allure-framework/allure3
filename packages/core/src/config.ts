import type { Config, PluginDescriptor } from "@allurereport/plugin-api";
import * as console from "node:console";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import * as process from "node:process";
import { parse } from "yaml";
import type { FullConfig, PluginInstance } from "./api.js";
import { readKnownIssues } from "./known.js";
import { FileSystemReportFiles } from "./plugin.js";
import { importWrapper } from "./utils/module.js";
import { normalizeImportPath } from "./utils/path.js";

export interface ConfigOverride {
  name?: Config["name"];
  output?: Config["output"];
  open?: Config["open"];
  port?: Config["port"];
  historyPath?: Config["historyPath"];
  historyLimit?: Config["historyLimit"];
  knownIssuesPath?: Config["knownIssuesPath"];
  plugins?: Config["plugins"];
}

const CONFIG_FILENAMES = [
  "allurerc.js",
  "allurerc.mjs",
  "allurerc.cjs",
  "allurerc.json",
  "allurerc.yaml",
  "allurerc.yml",
] as const;
const DEFAULT_CONFIG: Config = {} as const;

export const getPluginId = (key: string) => {
  return key.replace(/^@.*\//, "").replace(/[/\\]/g, "-");
};

/**
 * Tries to find the well-known config file in the given cwd or uses the provided config path
 * @param cwd
 * @param configPath
 */
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

  for (const configFilename of CONFIG_FILENAMES) {
    const resolved = resolve(cwd, configFilename);

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
    "open",
    "port",
    "historyPath",
    "historyLimit",
    "knownIssuesPath",
    "plugins",
    "defaultLabels",
    "variables",
    "environments",
    "appendHistory",
    "qualityGate",
    "allureService",
    "categories",
  ];
  const unsupportedFields = Object.keys(config).filter((key) => !supportedFields.includes(key as keyof Config));

  return {
    valid: unsupportedFields.length === 0,
    fields: unsupportedFields,
  };
};

/**
 * Loads the yaml config from the given path
 * If the file does not exist, returns the default config
 * @param configPath
 */
export const loadYamlConfig = async (configPath: string): Promise<Config> => {
  try {
    const rawConfig = await readFile(configPath, "utf-8");
    const parsedConfig = parse(rawConfig) as Config;

    return parsedConfig || DEFAULT_CONFIG;
  } catch (err) {
    if ((err as any)?.code === "ENOENT") {
      return DEFAULT_CONFIG;
    }

    throw err;
  }
};

/**
 * Loads the json config from the given path
 * If the file does not exist, returns the default config
 * @param configPath
 */
export const loadJsonConfig = async (configPath: string): Promise<Config> => {
  try {
    const rawConfig = await readFile(configPath, "utf-8");
    const parsedConfig = JSON.parse(rawConfig) as Config;

    return parsedConfig || DEFAULT_CONFIG;
  } catch (err) {
    if ((err as any)?.code === "ENOENT") {
      return DEFAULT_CONFIG;
    }

    throw err;
  }
};

/**
 * Loads the javascript config from the given path
 * @param configPath
 */
export const loadJsConfig = async (configPath: string): Promise<Config> => {
  return (await import(normalizeImportPath(configPath))).default;
};

export const resolveConfig = async (config: Config, override: ConfigOverride = {}): Promise<FullConfig> => {
  const validationResult = validateConfig(config);

  if (!validationResult.valid) {
    throw new Error(`The provided Allure config contains unsupported fields: ${validationResult.fields.join(", ")}`);
  }

  const name = override.name ?? config.name ?? "Allure Report";
  const open = override.open ?? config.open ?? false;
  const port = override.port ?? config.port ?? undefined;
  const historyPath = override.historyPath ?? config.historyPath;
  const historyLimit = override.historyLimit ?? config.historyLimit;
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
    open,
    port,
    knownIssuesPath,
    known,
    variables,
    environments,
    appendHistory,
    historyLimit,
    historyPath: historyPath ? resolve(historyPath) : undefined,
    reportFiles: new FileSystemReportFiles(output),
    plugins: pluginInstances,
    defaultLabels: config.defaultLabels ?? {},
    qualityGate: config.qualityGate,
    allureService: config.allureService,
    categories: config.categories,
  };
};

/**
 * Tries to read Allure Runtime configuration file in given cwd
 * If config path is not provided, tries to find well-known config file
 * Supports javascript, json and yaml config files
 * If nothing is found returns an empty config
 * @param cwd
 * @param configPath
 * @param override
 */
export const readConfig = async (
  cwd: string = process.cwd(),
  configPath?: string,
  override?: ConfigOverride,
): Promise<FullConfig> => {
  const cfg = (await findConfig(cwd, configPath)) ?? "";
  let config: Config;

  switch (extname(cfg)) {
    case ".json":
      config = await loadJsonConfig(cfg);
      break;
    case ".yaml":
    case ".yml":
      config = await loadYamlConfig(cfg);
      break;
    case ".js":
    case ".cjs":
    case ".mjs":
      config = await loadJsConfig(cfg);
      break;
    default:
      config = DEFAULT_CONFIG;
  }

  const fullConfig = await resolveConfig(config, override);

  return fullConfig;
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
