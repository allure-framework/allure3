import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { MAX_ENVIRONMENT_ID_LENGTH, MAX_ENVIRONMENT_NAME_LENGTH } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullConfig } from "../src/api.js";
import {
  findConfig,
  getPluginId,
  getPluginInstance,
  loadJsonConfig,
  loadYamlConfig,
  readConfig,
  resolveConfig,
  resolvePlugin,
  validateConfig,
} from "../src/config.js";
import { importWrapper } from "../src/utils/module.js";
import { isWindows } from "../src/utils/windows.js";

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

  it("should find allurerc.yaml in cwd", async () => {
    await writeFile(join(fixturesDir, "allurerc.yaml"), "some content", "utf-8");

    const found = await findConfig(fixturesDir);
    expect(found).toEqual(resolve(fixturesDir, "allurerc.yaml"));
  });

  it("should find allurerc.yml in cwd", async () => {
    await writeFile(join(fixturesDir, "allurerc.yml"), "some content", "utf-8");

    const found = await findConfig(fixturesDir);
    expect(found).toEqual(resolve(fixturesDir, "allurerc.yml"));
  });

  describe("default config files priority", () => {
    it("shoild attempt finding allurerc.js before allurerc.mjs", async () => {
      await writeFile(join(fixturesDir, "allurerc.js"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.mjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.cjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.json"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yaml"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yml"), "", "utf-8");

      const found = await findConfig(fixturesDir);
      expect(found).toEqual(resolve(fixturesDir, "allurerc.js"));
    });

    it("shoild attempt finding allurerc.mjs before allurerc.cjs", async () => {
      await writeFile(join(fixturesDir, "allurerc.mjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.cjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.json"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yaml"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yml"), "", "utf-8");

      const found = await findConfig(fixturesDir);
      expect(found).toEqual(resolve(fixturesDir, "allurerc.mjs"));
    });

    it("shoild attempt finding allurerc.cjs before allurerc.json", async () => {
      await writeFile(join(fixturesDir, "allurerc.cjs"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.json"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yaml"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yml"), "", "utf-8");

      const found = await findConfig(fixturesDir);
      expect(found).toEqual(resolve(fixturesDir, "allurerc.cjs"));
    });

    it("shoild attempt finding allurerc.json before allurerc.yaml", async () => {
      await writeFile(join(fixturesDir, "allurerc.json"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yaml"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yml"), "", "utf-8");

      const found = await findConfig(fixturesDir);
      expect(found).toEqual(resolve(fixturesDir, "allurerc.json"));
    });

    it("shoild attempt finding allurerc.yaml before allurerc.yml", async () => {
      await writeFile(join(fixturesDir, "allurerc.yaml"), "", "utf-8");
      await writeFile(join(fixturesDir, "allurerc.yml"), "", "utf-8");

      const found = await findConfig(fixturesDir);
      expect(found).toEqual(resolve(fixturesDir, "allurerc.yaml"));
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

  it("trims whitespace around the key", () => {
    expect(getPluginId("  awesome  ")).toEqual("awesome");
  });

  it("rejects empty and whitespace-only keys", () => {
    expect(() => getPluginId("")).toThrow(/empty or whitespace-only/);
    expect(() => getPluginId("   ")).toThrow(/empty or whitespace-only/);
  });

  it("rejects . and .. and .. segments after normalization", () => {
    expect(() => getPluginId("..")).toThrow(/must not/);
    expect(() => getPluginId(".")).toThrow(/must not/);
    expect(() => getPluginId("foo..bar")).toThrow(/must not contain/);
    expect(() => getPluginId("seg/foo/../bar")).toThrow(/must not contain/);
  });

  it.skipIf(!isWindows())("rejects characters invalid on Windows file names", () => {
    expect(() => getPluginId("foo<bar")).toThrow(/Windows/);
    expect(() => getPluginId("foo:bar")).toThrow(/Windows/);
    expect(() => getPluginId("foo|bar")).toThrow(/Windows/);
  });

  it.skipIf(!isWindows())("rejects Windows reserved device names", () => {
    expect(() => getPluginId("CON")).toThrow(/reserved/);
    expect(() => getPluginId("com1")).toThrow(/reserved/);
    expect(() => getPluginId("LPT2")).toThrow(/reserved/);
  });

  it.skipIf(isWindows())("allows Windows-forbidden id characters and reserved-like names on non-Windows", () => {
    expect(getPluginId("foo:bar")).toEqual("foo:bar");
    expect(getPluginId("com1")).toEqual("com1");
    expect(getPluginId("foo<bar")).toEqual("foo<bar");
  });
});

class ModuleNotFoundError extends Error {
  constructor() {
    super("Module not found");
  }

  code = "ERR_MODULE_NOT_FOUND";
}

describe("resolvePlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prepends @allurereport/plugin- prefix and tries to resolve plugin when the path is not scoped", async () => {
    const fixture = { name: "Allure" };

    (importWrapper as unknown as MockInstance).mockImplementation((path: string) => {
      if (path.startsWith("@allurereport")) {
        throw new ModuleNotFoundError();
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
    (importWrapper as unknown as MockInstance).mockRejectedValue(new ModuleNotFoundError());

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

  it("should return provided environment name", async () => {
    const fixture = {
      environment: "staging",
    };
    const resolved = await resolveConfig(fixture);

    expect(resolved.environment).toEqual("staging");
  });

  it("should normalize provided environment name", async () => {
    const resolved = await resolveConfig({
      environment: " staging ",
    });

    expect(resolved.environment).toEqual("staging");
  });

  it("should keep top-level hideLabels in resolved config", async () => {
    const resolved = await resolveConfig({
      hideLabels: ["owner", /^tag/],
    });

    expect(resolved.hideLabels).toEqual(["owner", /^tag/]);
  });

  it("should allow to override top-level hideLabels", async () => {
    const resolved = await resolveConfig(
      {
        hideLabels: ["owner"],
      },
      {
        hideLabels: ["tag"],
      },
    );

    expect(resolved.hideLabels).toEqual(["tag"]);
  });

  it("should allow to override given report name", async () => {
    const fixture = {
      name: "Allure",
    };
    const resolved = await resolveConfig(fixture, { name: "Custom" });

    expect(resolved.name).toEqual("Custom");
  });

  it("shouldn't set default history path if it's not provided", async () => {
    const fixture = {} as Config;
    const resolved = await resolveConfig(fixture);

    expect(resolved.historyPath).toBeUndefined();
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

  it("should allow to override given history limit", async () => {
    const fixture = {
      historyLimit: 10,
    };
    const resolved = await resolveConfig(fixture, { historyLimit: 5 });

    expect(resolved.historyLimit).toEqual(5);
  });

  it("should set awesome and agent as default plugins if no plugins are provided", async () => {
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
    expect((await resolveConfig({})).plugins).toContainEqual({
      id: "agent",
      enabled: true,
      options: {},
      plugin: expect.any(PluginFixture),
    });
    expect((await resolveConfig({ plugins: {} })).plugins).toContainEqual({
      id: "agent",
      enabled: true,
      options: {},
      plugin: expect.any(PluginFixture),
    });
  });

  it("should append agent after configured plugins when agent is not specified", async () => {
    const resolved = await resolveConfig({
      plugins: {
        awesome: {
          options: {
            reportName: "Custom",
          },
        },
      },
    });

    expect(resolved.plugins.map(({ id }) => id)).toEqual(["awesome", "agent"]);
  });

  it("should not duplicate agent when explicitly configured", async () => {
    const resolved = await resolveConfig({
      plugins: {
        awesome: {
          options: {},
        },
        agent: {
          options: {
            outputDir: "./out/agent-markdown",
          },
        },
      },
    });

    expect(resolved.plugins.filter(({ id }) => id === "agent")).toHaveLength(1);
  });

  it("should honor disabled agent config", async () => {
    const resolved = await resolveConfig({
      plugins: {
        awesome: {
          options: {},
        },
        agent: {
          enabled: false,
          options: {
            outputDir: "./out/agent-markdown",
          },
        },
      },
    });

    expect(resolved.plugins).toContainEqual({
      id: "agent",
      enabled: false,
      options: {
        outputDir: "./out/agent-markdown",
      },
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

  it("should reject top-level environmentName public config field", async () => {
    await expect(
      resolveConfig({ environmentName: "staging" } as Config & { environmentName?: string }),
    ).rejects.toThrow("The provided Allure config contains unsupported fields: environmentName");
  });

  it("should reject top-level environmentId public config field", async () => {
    await expect(resolveConfig({ environmentId: "qa_env" } as Config & { environmentId?: string })).rejects.toThrow(
      "The provided Allure config contains unsupported fields: environmentId",
    );
  });

  it("should throw an error for invalid forced environment name", async () => {
    await expect(resolveConfig({ environment: "" })).rejects.toThrow(
      "The provided Allure config contains invalid environments: environment name must not be empty",
    );
  });

  it("should throw an error for invalid forced environment control characters", async () => {
    await expect(resolveConfig({ environment: "foo\nbar" })).rejects.toThrow(
      "The provided Allure config contains invalid environments: environment name must not contain control characters",
    );
  });

  it("should throw an error for invalid environment id with control characters", async () => {
    await expect(
      resolveConfig({
        environments: {
          "foo\r\nbar": {
            matcher: () => true,
          },
        },
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config.environments["foo\\r\\nbar"]: id must contain only latin letters, digits, underscores, and hyphens',
    );
  });

  it("should reject environment ids with unsupported characters", async () => {
    await expect(
      resolveConfig({
        environments: {
          "foo/bar": {
            matcher: () => true,
          },
        },
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config.environments["foo/bar"]: id must contain only latin letters, digits, underscores, and hyphens',
    );
  });

  it("should normalize environment values and keys", async () => {
    const resolved = await resolveConfig({
      environment: "default",
      environments: {
        foo: {
          matcher: () => true,
        },
      },
    });

    expect(resolved.environment).toBe("default");
    expect(Object.keys(resolved.environments)).toEqual(["foo"]);
  });

  it("should accept environment ID in the public environment field", async () => {
    const resolved = await resolveConfig({
      environment: "qa_env",
      environments: {
        qa_env: {
          name: " QA Env ",
          matcher: () => true,
        },
      },
    });

    expect(resolved.environment).toBe("qa_env");
    expect(Object.keys(resolved.environments)).toEqual(["qa_env"]);
    expect(resolved.environments?.qa_env?.name).toBe("QA Env");
  });

  it("should resolve environment display name to environment ID in the public environment field", async () => {
    const resolved = await resolveConfig({
      environment: " QA Env ",
      environments: {
        qa_env: {
          name: "QA Env",
          matcher: () => true,
        },
      },
    });

    expect(resolved.environment).toBe("qa_env");
  });

  it("should keep configured environment ids in resolved environments config", async () => {
    const resolved = await resolveConfig({
      environments: {
        compat_env: {
          name: "Compat Env",
          matcher: () => true,
        },
      },
    });

    expect(Object.keys(resolved.environments)).toEqual(["compat_env"]);
  });

  it("should reject duplicate display names across explicit environment ids", async () => {
    await expect(
      resolveConfig({
        environments: {
          qa_one: {
            name: "QA",
            matcher: () => true,
          },
          qa_two: {
            name: " QA ",
            matcher: () => false,
          },
        },
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config.environments: normalized environment name "QA" is produced by ids ["qa_one","qa_two"]',
    );
  });

  it("should trim surrounding spaces from configured environment ids", async () => {
    const resolved = await resolveConfig({
      environments: {
        " QA ": {
          matcher: () => true,
        },
      },
    });

    expect(Object.keys(resolved.environments)).toEqual(["QA"]);
    expect(resolved.environments.QA?.name).toBe("QA");
  });

  it("should reject duplicate ids after trimming surrounding spaces", async () => {
    await expect(
      resolveConfig({
        environments: {
          "foo": {
            matcher: () => true,
          },
          " foo ": {
            matcher: () => false,
          },
        },
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config.environments: normalized key "foo" is produced by original keys ["foo"," foo "]',
    );
  });

  it("should accept environment names with max allowed length", async () => {
    const validBoundaryName = "a".repeat(MAX_ENVIRONMENT_NAME_LENGTH);

    await expect(
      resolveConfig({
        environment: validBoundaryName,
        environments: {
          [validBoundaryName]: {
            matcher: () => true,
          },
        },
      }),
    ).resolves.toBeDefined();
  });

  it("should accept configured environment ids with max allowed length through environment", async () => {
    const validBoundaryId = "a".repeat(MAX_ENVIRONMENT_ID_LENGTH);

    await expect(
      resolveConfig({
        environment: validBoundaryId,
        environments: {
          [validBoundaryId]: {
            name: "QA",
            matcher: () => true,
          },
        },
      }),
    ).resolves.toBeDefined();
  });

  it("should reject environments outside allowedEnvironments in config.environment", async () => {
    await expect(
      resolveConfig({
        environment: "baz",
        allowedEnvironments: ["foo", "bar"],
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config: environment id "baz" is not listed in allowedEnvironments',
    );
  });

  it("should reject invalid allowed environment ids", async () => {
    await expect(
      resolveConfig({
        allowedEnvironments: ["foo", "bar baz"],
      }),
    ).rejects.toThrow(
      "The provided Allure config contains invalid environments: config.allowedEnvironments[1]: id must contain only latin letters, digits, underscores, and hyphens",
    );
  });

  it("should reject allowed environment ids with surrounding spaces instead of normalizing them", async () => {
    await expect(
      resolveConfig({
        allowedEnvironments: [" foo "],
      }),
    ).rejects.toThrow(
      "The provided Allure config contains invalid environments: config.allowedEnvironments[0]: id must not contain leading or trailing whitespace",
    );
  });

  it("should reject duplicate allowed environment ids", async () => {
    await expect(
      resolveConfig({
        allowedEnvironments: ["foo", "foo"],
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config.allowedEnvironments: duplicated environment id "foo"',
    );
  });

  it("should reject configured environments outside allowedEnvironments", async () => {
    await expect(
      resolveConfig({
        allowedEnvironments: ["foo"],
        environments: {
          foo: {
            matcher: () => true,
          },
          bar: {
            matcher: () => false,
          },
        },
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config.environments: environment id "bar" is not listed in allowedEnvironments',
    );
  });

  it("should keep display-name-only allowed environment entries raw and unmatched", async () => {
    await expect(
      resolveConfig({
        environment: "QA",
        allowedEnvironments: ["QA"],
        environments: {
          qa_env: {
            name: "QA",
            matcher: () => true,
          },
        },
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config: environment id "qa_env" is not listed in allowedEnvironments',
    );
  });

  it("should reject forced environments outside allowedEnvironments", async () => {
    await expect(
      resolveConfig({
        environment: "QA",
        allowedEnvironments: ["prod"],
        environments: {
          qa: {
            name: "QA",
            matcher: () => true,
          },
        },
      }),
    ).rejects.toThrow(
      'The provided Allure config contains invalid environments: config: environment id "qa" is not listed in allowedEnvironments',
    );
  });

  it("should not validate quality gate environment ids against allowedEnvironments", async () => {
    await expect(
      resolveConfig({
        allowedEnvironments: ["qa_env"],
        qualityGate: {
          rules: [{ allTestsContainEnv: "bar", environmentsTested: ["qa_env", "bar"] }],
        },
      }),
    ).resolves.toBeDefined();
  });

  it("should not require default to be listed in allowedEnvironments", async () => {
    await expect(
      resolveConfig({
        allowedEnvironments: ["foo"],
        environments: {
          foo: {
            matcher: () => true,
          },
        },
      }),
    ).resolves.toBeDefined();
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

describe("readConfig", () => {
  let fixturesDir: string;

  beforeEach(async () => {
    fixturesDir = await mkdtemp("config.test.ts-readConfig-");
  });

  afterEach(async () => {
    try {
      await rm(fixturesDir, { recursive: true });
    } catch (err) {}
  });

  it("should read a .js config", async () => {
    const configName = "config.js";
    const configContent = "export default { name: 'Foo' };";
    await writeFile(join(fixturesDir, configName), configContent, "utf-8");

    const config = await readConfig(fixturesDir, configName);

    expect(config).toEqual(expect.objectContaining({ name: "Foo" }));
  });

  it("should read a .mjs config", async () => {
    const configName = "config.mjs";
    const configContent = "export default { name: 'Foo' };";
    await writeFile(join(fixturesDir, configName), configContent, "utf-8");

    const config = await readConfig(fixturesDir, configName);

    expect(config).toEqual(expect.objectContaining({ name: "Foo" }));
  });

  it("should read a .cjs config", async () => {
    const configName = "config.cjs";
    const configContent = "module.exports = { name: 'Foo' };";
    await writeFile(join(fixturesDir, configName), configContent, "utf-8");

    const config = await readConfig(fixturesDir, configName);

    expect(config).toEqual(expect.objectContaining({ name: "Foo" }));
  });

  it("should read a .json config", async () => {
    const configName = "config.json";
    const configContent = '{ "name": "Foo" }';
    await writeFile(join(fixturesDir, configName), configContent, "utf-8");

    const config = await readConfig(fixturesDir, configName);

    expect(config).toEqual(expect.objectContaining({ name: "Foo" }));
  });

  it("should read a .yaml config", async () => {
    const configName = "config.yaml";
    const configContent = 'name: "Foo"';
    await writeFile(join(fixturesDir, configName), configContent, "utf-8");

    const config = await readConfig(fixturesDir, configName);

    expect(config).toEqual(expect.objectContaining({ name: "Foo" }));
  });

  it("should read a .yml config", async () => {
    const configName = "config.yaml";
    const configContent = 'name: "Foo"';
    await writeFile(join(fixturesDir, configName), configContent, "utf-8");

    const config = await readConfig(fixturesDir, configName);

    expect(config).toEqual(expect.objectContaining({ name: "Foo" }));
  });

  it("should read top-level hideLabels from js config", async () => {
    const configName = "config.mjs";
    const configContent = 'export default { hideLabels: ["owner"] };';
    await writeFile(join(fixturesDir, configName), configContent, "utf-8");

    const config = await readConfig(fixturesDir, configName);

    expect(config).toEqual(expect.objectContaining({ hideLabels: ["owner"] }));
  });
});
