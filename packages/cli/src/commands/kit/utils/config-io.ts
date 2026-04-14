import { access, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { parse: parseYaml, stringify: stringifyYaml } = require("yaml") as typeof import("yaml");

export type ConfigFormat = "json" | "yaml" | "mjs";

export interface AllureConfig {
  name?: string;
  output?: string;
  plugins?: Record<string, PluginEntry>;
  [key: string]: unknown;
}

export interface PluginEntry {
  import?: string;
  enabled?: boolean;
  options?: Record<string, unknown>;
}

const CONFIG_FILENAMES: { filename: string; format: ConfigFormat }[] = [
  { filename: "allurerc.json", format: "json" },
  { filename: "allurerc.yaml", format: "yaml" },
  { filename: "allurerc.yml", format: "yaml" },
  { filename: "allurerc.mjs", format: "mjs" },
  { filename: "allurerc.js", format: "mjs" },
  { filename: "allurerc.cjs", format: "mjs" },
];

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const findExistingConfig = async (cwd: string): Promise<{ path: string; format: ConfigFormat } | null> => {
  for (const { filename, format } of CONFIG_FILENAMES) {
    const configPath = resolve(cwd, filename);

    if (await fileExists(configPath)) {
      return { path: configPath, format };
    }
  }

  return null;
};

export const readAllureConfig = async (cwd: string): Promise<AllureConfig | null> => {
  const existing = await findExistingConfig(cwd);

  if (!existing) {
    return null;
  }

  const content = await readFile(existing.path, "utf-8");

  switch (existing.format) {
    case "json":
      return JSON.parse(content) as AllureConfig;
    case "yaml":
      return (parseYaml(content) as AllureConfig) ?? {};
    case "mjs":
      return null;
  }
};

export const writeAllureConfig = async (cwd: string, config: AllureConfig, format: ConfigFormat): Promise<string> => {
  const filename = getConfigFilename(format);
  const filePath = resolve(cwd, filename);
  const content = serializeConfig(config, format);

  await writeFile(filePath, content, "utf-8");

  return filename;
};

export const getConfigFilename = (format: ConfigFormat): string => {
  switch (format) {
    case "json":
      return "allurerc.json";
    case "yaml":
      return "allurerc.yaml";
    case "mjs":
      return "allurerc.mjs";
  }
};

const serializeConfig = (config: AllureConfig, format: ConfigFormat): string => {
  switch (format) {
    case "json":
      return JSON.stringify(config, null, 2) + "\n";
    case "yaml":
      return stringifyYaml(config);
    case "mjs":
      return serializeAsEsm(config);
  }
};

const serializeAsEsm = (config: AllureConfig): string => {
  const configJson = JSON.stringify(config, null, 2);

  return `import { defineConfig } from "allure";\n\nexport default defineConfig(${configJson});\n`;
};

export const updateConfigPlugins = async (
  cwd: string,
  pluginId: string,
  pluginEntry: PluginEntry | null,
): Promise<boolean> => {
  const existing = await findExistingConfig(cwd);

  if (!existing || existing.format === "mjs") {
    return false;
  }

  const config = await readAllureConfig(cwd);

  if (!config) {
    return false;
  }

  if (!config.plugins) {
    config.plugins = {};
  }

  if (pluginEntry === null) {
    delete config.plugins[pluginId];
  } else {
    config.plugins[pluginId] = pluginEntry;
  }

  await writeAllureConfig(cwd, config, existing.format);

  return true;
};

export const updateConfigProperty = async (cwd: string, key: string, value: unknown): Promise<boolean> => {
  const existing = await findExistingConfig(cwd);

  if (!existing || existing.format === "mjs") {
    return false;
  }

  const config = await readAllureConfig(cwd);

  if (!config) {
    return false;
  }

  config[key] = value;

  await writeAllureConfig(cwd, config, existing.format);

  return true;
};

export const getConfigProperty = async (cwd: string, key: string): Promise<unknown> => {
  const config = await readAllureConfig(cwd);

  if (!config) {
    return undefined;
  }

  return config[key];
};
