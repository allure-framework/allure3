import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { MockInstance } from "vitest";
import { afterEach } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findConfig, getPluginId, resolvePlugin, validateConfig } from "../src/config.js";
import { importWrapper } from "../src/utils/module.js";

vi.mock("../src/utils/module.js", () => ({
  importWrapper: vi.fn(),
}));

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

  it("should find allurerc.js first", async () => {
    await writeFile(join(fixturesDir, "allurerc.js"), "some content", "utf-8");
    await writeFile(join(fixturesDir, "allurerc.mjs"), "some other content", "utf-8");

    const found = await findConfig(fixturesDir);
    expect(found).toEqual(resolve(fixturesDir, "allurerc.js"));
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

    expect(() => resolvePlugin("classic")).rejects.toThrow("Cannot resolve plugin: classic");
  });
});
