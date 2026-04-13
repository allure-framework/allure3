import * as console from "node:console";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import * as process from "node:process";

import { validateEnvironmentName } from "@allurereport/core-api";
import type { Config, PluginDescriptor } from "@allurereport/plugin-api";
import { parse } from "yaml";

import type { FullConfig, PluginInstance } from "./api.js";
import { readKnownIssues } from "./known.js";
import { FileSystemReportFiles } from "./plugin.js";
import {
  environmentIdentityById,
  environmentIdentityByName,
  normalizeEnvironmentDescriptorMap,
} from "./utils/environment.js";
import { importWrapper } from "./utils/module.js";
import { normalizeImportPath } from "./utils/path.js";
import { assertValidPluginIdForWindows, isWindows } from "./utils/windows.js";

export interface ConfigOverride {
  name?: Config["name"];
  output?: Config["output"];
  open?: Config["open"];
  port?: Config["port"];
  hideLabels?: Config["hideLabels"];
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

const isAgentDescriptor = (value: string | undefined) => {
  return value === "agent" || value === "@allurereport/plugin-agent";
};

const hasConfiguredAgent = (plugins: Record<string, PluginDescriptor>) => {
  return Object.entries(plugins).some(
    ([key, descriptor]) => isAgentDescriptor(key) || isAgentDescriptor(descriptor.import),
  );
};

/**
 * Ensures a plugin id is safe as a single path segment
 */
export const assertValidPluginId = (id: string): void => {
  if (id.length === 0) {
    throw new Error("Invalid plugin id: must not be empty");
  }

  if (id === "." || id === "..") {
    throw new Error(`Invalid plugin id ${JSON.stringify(id)}: must not be "." or ".."`);
  }

  if (id.includes("..")) {
    throw new Error(`Invalid plugin id ${JSON.stringify(id)}: must not contain ".."`);
  }

  if (/[/\\]/.test(id)) {
    throw new Error(`Invalid plugin id ${JSON.stringify(id)}: must not contain path separators`);
  }

  if (isWindows()) {
    assertValidPluginIdForWindows(id);
  }
};

export const getPluginId = (key: string): string => {
  const trimmed = key.trim();

  if (trimmed.length === 0) {
    throw new Error(`Invalid plugin key ${JSON.stringify(key)}: must not be empty or whitespace-only`);
  }

  const id = trimmed.replace(/^@.*\//, "").replace(/[/\\]/g, "-");

  assertValidPluginId(id);

  return id;
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
  const supportedFields = [
    "name",
    "output",
    "open",
    "port",
    "hideLabels",
    "historyPath",
    "historyLimit",
    "knownIssuesPath",
    "plugins",
    "defaultLabels",
    "variables",
    "environment",
    "environments",
    "appendHistory",
    "qualityGate",
    "allureService",
    "categories",
    "globalAttachments",
  ] as const;
  const unsupportedFields = Object.keys(config).filter(
    (key) => !supportedFields.includes(key as (typeof supportedFields)[number]),
  );

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

const resolveConfigEnvironments = (config: Config) => {
  const errors: string[] = [];
  const { normalized: environments, errors: environmentErrors } = normalizeEnvironmentDescriptorMap(
    config.environments ?? {},
    "config.environments",
  );
  let environment: string | undefined;

  errors.push(...environmentErrors);

  if (config.environment !== undefined) {
    const environmentResult = validateEnvironmentName(config.environment);

    if (!environmentResult.valid) {
      errors.push(`environment ${environmentResult.reason}`);
    } else {
      const normalizedEnvironment = environmentResult.normalized;

      environment =
        environmentIdentityById(environments, normalizedEnvironment)?.id ??
        environmentIdentityByName(environments, normalizedEnvironment)?.id ??
        normalizedEnvironment;
    }
  }

  if (errors.length > 0) {
    throw new Error(`The provided Allure config contains invalid environments: ${errors.join("; ")}`);
  }

  return {
    environments,
    environment,
  };
};

export const resolveConfig = async (config: Config, override: ConfigOverride = {}): Promise<FullConfig> => {
  const validationResult = validateConfig(config);

  if (!validationResult.valid) {
    throw new Error(`The provided Allure config contains unsupported fields: ${validationResult.fields.join(", ")}`);
  }

  const { environments, environment } = resolveConfigEnvironments(config);

  const name = override.name ?? config.name ?? "Allure Report";
  const open = override.open ?? config.open ?? false;
  const port = override.port ?? config.port ?? undefined;
  const hideLabels = override.hideLabels ?? config.hideLabels;
  const historyPath = override.historyPath ?? config.historyPath;
  const historyLimit = override.historyLimit ?? config.historyLimit;
  const appendHistory = config.appendHistory ?? true;
  const knownIssuesPath = resolve(override.knownIssuesPath ?? config.knownIssuesPath ?? "./allure/known.json");
  const output = resolve(override.output ?? config.output ?? "./allure-report");
  const known = await readKnownIssues(knownIssuesPath);
  const variables = config.variables ?? {};
  const configuredPlugins = override.plugins ?? config.plugins;
  const basePlugins =
    Object.keys(configuredPlugins ?? {}).length === 0
      ? {
          awesome: {
            options: {},
          },
        }
      : configuredPlugins!;
  const plugins = hasConfiguredAgent(basePlugins)
    ? basePlugins
    : {
        ...basePlugins,
        agent: {
          options: {},
        },
      };
  const pluginInstances = await resolvePlugins(plugins);

  return {
    name,
    output,
    open,
    port,
    hideLabels,
    knownIssuesPath,
    known,
    environment,
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
    globalAttachments: config.globalAttachments,
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

/**
 * Checks if the error is a module not found error
 *
 * @see https://nodejs.org/api/errors.html#err-module-not-found
 */
const isModuleNotFoundError = (err: unknown): err is Error & { code: "ERR_MODULE_NOT_FOUND" } => {
  return err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
};

export const resolvePlugin = async (path: string) => {
  // try to append @allurereport/plugin- scope
  if (!path.startsWith("@allurereport/plugin-")) {
    try {
      const module = await importWrapper(`@allurereport/plugin-${path}`);

      return module.default;
    } catch (err) {
      // Only suppress "module not found" errors
      // because we will try to resolve plugin without "@allurereport/plugin-" prefix
      if (!isModuleNotFoundError(err)) {
        // This means that there is a problem with the plugin code itself, so throw away!
        throw err;
      }
    }
  }

  try {
    const module = await importWrapper(path);

    return module.default;
  } catch {
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
