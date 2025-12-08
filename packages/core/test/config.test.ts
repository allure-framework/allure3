import type { Config } from "@allurereport/plugin-api";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FullConfig } from "../src/api.js";
import {
  findConfig,
  getPluginId,
  getPluginInstance,
  loadJsonConfig,
  loadYamlConfig,
  resolveConfig,
  resolvePlugin,
  validateConfig,
} from "../src/config.js";
import { importWrapper } from "../src/utils/module.js";

class PluginFixture {}

vi.mock("../src/utils/module.js", () => ({
  importWrapper: vi.fn(),
}));

beforeEach(() => {
  (importWrapper as unknown as MockInstance).mockResolvedValue({ default: PluginFixture });
});

describe("findConfig", () => {
  let fixturesDir: string;

  beforeEach(async () => {
    fixturesDir = await mkdtemp("config.test.ts-findConfig-");
  });

  afterEach(async () => {
    try {
      await rm(fixturesDir, { recursive: true });
    } catch (err) {}
  });

  it("should find allurerc.js in cwd", async () => {
    await writeFile(join(fixturesDir, "allurerc.js"), "some content", "utf-8");

    const found = await findConfig(fixturesDir);
    expect(found).toEqual(resolve(fixturesDir, "allurerc.js"));
  });

  it("should find allurerc.mjs in cwd", async () => {
    await writeFile(join(fixturesDir, "allurerc.mjs"), "some content", "utf-8");

    const found = await findConfig(fixturesDir);
    expect(found).toEqual(resolve(fixturesDir, "allurerc.mjs"));
  });

  it("should find allurerc.cjs in cwd", async () => {
    await writeFile(join(fixturesDir, "allurerc.cjs"), "some content", "utf-8");

    const found = await findConfig(fixturesDir);
    expect(found).toEqual(resolve(fixturesDir, "allurerc.cjs"));
  });

  it("should find allurerc.json in cwd", async () => {
    await writeFile(join(fixturesDir, "allurerc.json"), "some content", "utf-8");

    const found = await findConfig(fixturesDir);
    expect(found).toEqual(resolve(fixturesDir, "allurerc.json"));
  });

  describe("default config files priority", () => {
    it("shoild attempt finding allurerc.js before allurerc.mjs", async () => {
      await writeFile(join(fixturesDir, "allurerc.js"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.mjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.cjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.json"), "", "utf-8");

      const found = await findConfig(fixturesDir);
      expect(found).toEqual(resolve(fixturesDir, "allurerc.js"));
    });

    it("shoild attempt finding allurerc.mjs before allurerc.cjs", async () => {
      await writeFile(join(fixturesDir, "allurerc.mjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.cjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.json"), "", "utf-8");

      const found = await findConfig(fixturesDir);
      expect(found).toEqual(resolve(fixturesDir, "allurerc.mjs"));
    });

    it("shoild attempt finding allurerc.cjs before allurerc.json", async () => {
      await writeFile(join(fixturesDir, "allurerc.cjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.json"), "", "utf-8");

      const found = await findConfig(fixturesDir);
      expect(found).toEqual(resolve(fixturesDir, "allurerc.cjs"));
    });
  });

  it("should find provided config path first", async () => {
    const fileName = "config.js";
    await writeFile(join(fixturesDir, fileName), "some content", "utf-8");

    const found = await findConfig(fixturesDir, fileName);
    expect(found).toEqual(resolve(fixturesDir, fileName));
  });

  it("should fail if provided config file is not found", async () => {
    const fileName = "config.js";

    await expect(findConfig(fixturesDir, fileName)).rejects.toThrow("invalid config path");
  });

  it("should accept absolute path to config", async () => {
    const fileName = "config.js";
    await writeFile(join(fixturesDir, fileName), "some content", "utf-8");

    const found = await findConfig(fixturesDir, resolve(fixturesDir, fileName));
    expect(found).toEqual(resolve(fixturesDir, fileName));
  });
});

describe("validateConfig", () => {
  it("should return a positive result if the config is valid", () => {
    expect(validateConfig({ name: "Allure" })).toEqual({
      valid: true,
      fields: [],
    });
  });

  it("should return array of unsupported fields if the config contains them", () => {
    // @ts-ignore
    expect(validateConfig({ name: "Allure", unknownField: "value" })).toEqual({
      valid: false,
      fields: ["unknownField"],
    });
  });
});

describe("getPluginId", () => {
  it("cuts off npm package scope and returns the rest part", () => {
    expect(getPluginId("@allurereport/classic")).toEqual("classic");
  });

  it("returns the same string if it doesn't have scope", () => {
    expect(getPluginId("classic")).toEqual("classic");
  });

  it("replaces slashes with dashes", () => {
    expect(getPluginId("allure/plugin/foo")).toEqual("allure-plugin-foo");
    expect(getPluginId("allure\\plugin\\foo")).toEqual("allure-plugin-foo");
  });
});

describe("resolvePlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prepends @allurereport/plugin- prefix and tries to resolve plugin when the path is not scoped", async () => {
    const fixture = { name: "Allure" };

    (importWrapper as unknown as MockInstance).mockImplementation((path: string) => {
      if (path.startsWith("@allurereport")) {
        throw new Error("not found");
      }

      return { default: fixture };
    });

    const plugin = await resolvePlugin("classic");

    expect(importWrapper).toHaveBeenCalledTimes(2);
    expect(importWrapper).toHaveBeenCalledWith("@allurereport/plugin-classic");
    expect(importWrapper).toHaveBeenCalledWith("classic");
    expect(plugin).toEqual(fixture);
  });

  it("throws an error when plugin can't be resolved", async () => {
    (importWrapper as unknown as MockInstance).mockRejectedValue(new Error("an error"));

    await expect(() => resolvePlugin("classic")).rejects.toThrow("Cannot resolve plugin: classic");
  });
});

describe("resolveConfig", () => {
  it("should set default name if it's not provided", async () => {
    const fixture = {} as Config;
    const resolved = await resolveConfig(fixture);

    expect(resolved.name).toEqual("Allure Report");
  });

  it("should return provided report name", async () => {
    const fixture = {
      name: "Allure",
    };
    const resolved = await resolveConfig(fixture);

    expect(resolved.name).toEqual(fixture.name);
  });

  it("should allow to override given report name", async () => {
    const fixture = {
      name: "Allure",
    };
    const resolved = await resolveConfig(fixture, { name: "Custom" });

    expect(resolved.name).toEqual("Custom");
  });

  it("should set default history path if it's not provided", async () => {
    const fixture = {} as Config;
    const resolved = await resolveConfig(fixture);

    expect(resolved.historyPath).toEqual(resolve("./.allure/history.jsonl"));
  });

  it("should return provided history path", async () => {
    const fixture = {
      historyPath: "./history.jsonl",
    };
    const resolved = await resolveConfig(fixture);

    expect(resolved.historyPath).toEqual(resolve("./history.jsonl"));
  });

  it("should allow to override given history path", async () => {
    const fixture = {
      historyPath: "./history.jsonl",
    };
    const resolved = await resolveConfig(fixture, { historyPath: "./custom/history.jsonl" });

    expect(resolved.historyPath).toEqual(resolve("./custom/history.jsonl"));
  });

  it("should set default known issues path if it's not provided", async () => {
    const fixture = {} as Config;
    const resolved = await resolveConfig(fixture);

    expect(resolved.knownIssuesPath).toEqual(resolve("./allure/known.json"));
  });

  it("should return provided known issues path", async () => {
    const fixture = {
      knownIssuesPath: "./known.json",
    };
    const resolved = await resolveConfig(fixture);

    expect(resolved.knownIssuesPath).toEqual(resolve("./known.json"));
  });

  it("should allow to override given known issues path", async () => {
    const fixture = {
      knownIssuesPath: "./known.json",
    };
    const resolved = await resolveConfig(fixture, { knownIssuesPath: "./custom/known.json" });

    expect(resolved.knownIssuesPath).toEqual(resolve("./custom/known.json"));
  });

  it("should set awesome as a default plugin if no plugins are provided", async () => {
    (importWrapper as unknown as MockInstance).mockResolvedValue({ default: PluginFixture });

    expect((await resolveConfig({})).plugins).toContainEqual({
      id: "awesome",
      enabled: true,
      options: {},
      plugin: expect.any(PluginFixture),
    });
    expect((await resolveConfig({ plugins: {} })).plugins).toContainEqual({
      id: "awesome",
      enabled: true,
      options: {},
      plugin: expect.any(PluginFixture),
    });
  });

  it("should throw an error when config contains unsupported fields", async () => {
    const fixture = {
      name: "Allure",
      unsupportedField: "value",
    } as Config;

    await expect(resolveConfig(fixture)).rejects.toThrow(
      "The provided Allure config contains unsupported fields: unsupportedField",
    );
  });
});

describe("getPluginInstance", () => {
  it("should return plugin instance for the given plugin", () => {
    const fixture = {
      id: "awesome",
      enabled: true,
      options: {
        groupBy: ["test"],
      },
      plugin: new PluginFixture(),
    };
    const config = {
      plugins: [fixture],
    } as unknown as FullConfig;

    const pluginInstance = getPluginInstance(config, ({ plugin }) => plugin instanceof PluginFixture);

    expect(pluginInstance).toEqual(fixture);
  });

  it("should return first matched plugin instance when there are more same plugins definition than one", () => {
    const fixture1 = {
      id: "awesome1",
      enabled: true,
      options: {
        groupBy: ["test"],
      },
      plugin: new PluginFixture(),
    };
    const fixture2 = {
      id: "awesome2",
      enabled: true,
      options: {
        groupBy: ["test2"],
      },
      plugin: new PluginFixture(),
    };
    const config = {
      plugins: [fixture1, fixture2],
    } as unknown as FullConfig;

    const pluginInstance = getPluginInstance(config, ({ plugin }) => plugin instanceof PluginFixture);

    expect(pluginInstance).toEqual(fixture1);
  });
});

describe("loadJsonConfig", () => {
  let fixturesDir: string;

  beforeEach(async () => {
    fixturesDir = await mkdtemp("config.test.ts-loadJsonConfig-");
  });

  afterEach(async () => {
    try {
      await rm(fixturesDir, { recursive: true });
    } catch (err) {}
  });

  it("should load valid json config file", async () => {
    const configPath = join(fixturesDir, "config.json");
    const configData = {
      name: "Test Report",
      historyPath: "./history.jsonl",
    };

    await writeFile(configPath, JSON.stringify(configData), "utf-8");

    const config = await loadJsonConfig(configPath);

    expect(config).toEqual(configData);
  });

  it("should return default config when file doesn't exist", async () => {
    const configPath = join(fixturesDir, "nonexistent.json");
    const config = await loadJsonConfig(configPath);

    expect(config).toEqual({});
  });

  it("should throw error when json is invalid", async () => {
    const configPath = join(fixturesDir, "invalid.json");

    await writeFile(configPath, "{ invalid json }", "utf-8");

    await expect(loadJsonConfig(configPath)).rejects.toThrow();
  });

  it("should return default config when parsed json is null", async () => {
    const configPath = join(fixturesDir, "empty.json");

    await writeFile(configPath, "null", "utf-8");

    const config = await loadJsonConfig(configPath);

    expect(config).toEqual({});
  });
});

describe("loadYamlConfig", () => {
  let fixturesDir: string;

  beforeEach(async () => {
    fixturesDir = await mkdtemp("config.test.ts-loadYamlConfig-");
  });

  afterEach(async () => {
    try {
      await rm(fixturesDir, { recursive: true });
    } catch (err) {}
  });

  it("should load valid yaml config file", async () => {
    const configPath = join(fixturesDir, "config.yaml");
    const yamlContent = `name: Test Report
historyPath: ./history.jsonl
knownIssuesPath: ./known.json`;
    await writeFile(configPath, yamlContent, "utf-8");

    const config = await loadYamlConfig(configPath);

    expect(config).toEqual({
      name: "Test Report",
      historyPath: "./history.jsonl",
      knownIssuesPath: "./known.json",
    });
  });

  it("should return default config when file doesn't exist", async () => {
    const configPath = join(fixturesDir, "nonexistent.yaml");
    const config = await loadYamlConfig(configPath);

    expect(config).toEqual({});
  });

  it("should throw error when yaml is invalid", async () => {
    const configPath = join(fixturesDir, "invalid.yaml");

    await writeFile(configPath, "name: Test\n  invalid: yaml\n   structure", "utf-8");

    await expect(loadYamlConfig(configPath)).rejects.toThrow();
  });
});
