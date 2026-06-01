import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findExistingConfig,
  getConfigProperty,
  readAllureConfig,
  updateConfigPlugins,
  updateConfigProperty,
  writeAllureConfig,
} from "../../src/commands/kit/utils/config-io.js";

describe("kit/config-io", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "allure-setup-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("findExistingConfig", () => {
    it("should find allurerc.json", async () => {
      await writeFile(join(tempDir, "allurerc.json"), "{}");

      const result = await findExistingConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result?.format).toBe("json");
    });

    it("should find allurerc.yaml", async () => {
      await writeFile(join(tempDir, "allurerc.yaml"), "name: test");

      const result = await findExistingConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result?.format).toBe("yaml");
    });

    it("should find allurerc.mjs", async () => {
      await writeFile(join(tempDir, "allurerc.mjs"), "export default {}");

      const result = await findExistingConfig(tempDir);

      expect(result).not.toBeNull();
      expect(result?.format).toBe("mjs");
    });

    it("should return null when no config exists", async () => {
      const result = await findExistingConfig(tempDir);

      expect(result).toBeNull();
    });

    it("should prefer json over yaml", async () => {
      await writeFile(join(tempDir, "allurerc.json"), "{}");
      await writeFile(join(tempDir, "allurerc.yaml"), "name: test");

      const result = await findExistingConfig(tempDir);

      expect(result?.format).toBe("json");
    });
  });

  describe("writeAllureConfig", () => {
    it("should write JSON config", async () => {
      const config = { name: "Test Report", plugins: { awesome: { options: {} } } };

      const filename = await writeAllureConfig(tempDir, config, "json");

      expect(filename).toBe("allurerc.json");

      const content = await readFile(join(tempDir, filename), "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("Test Report");
      expect(parsed.plugins.awesome).toBeDefined();
    });

    it("should write YAML config", async () => {
      const config = { name: "Test Report", plugins: { awesome: { options: {} } } };

      const filename = await writeAllureConfig(tempDir, config, "yaml");

      expect(filename).toBe("allurerc.yaml");

      const content = await readFile(join(tempDir, filename), "utf-8");

      expect(content).toContain("name: Test Report");
    });

    it("should write ESM config", async () => {
      const config = { name: "Test Report", plugins: { awesome: { options: {} } } };

      const filename = await writeAllureConfig(tempDir, config, "mjs");

      expect(filename).toBe("allurerc.mjs");

      const content = await readFile(join(tempDir, filename), "utf-8");

      expect(content).toContain('import { defineConfig } from "allure"');
      expect(content).toContain("export default defineConfig(");
      expect(content).toContain('"Test Report"');
    });
  });

  describe("readAllureConfig", () => {
    it("should read JSON config", async () => {
      const original = { name: "Test Report", plugins: { awesome: { options: {} } } };

      await writeFile(join(tempDir, "allurerc.json"), JSON.stringify(original));

      const config = await readAllureConfig(tempDir);

      expect(config?.name).toBe("Test Report");
      expect(config?.plugins?.awesome).toBeDefined();
    });

    it("should read YAML config", async () => {
      await writeFile(join(tempDir, "allurerc.yaml"), "name: Test Report\nplugins:\n  awesome:\n    options: {}\n");

      const config = await readAllureConfig(tempDir);

      expect(config?.name).toBe("Test Report");
      expect(config?.plugins?.awesome).toBeDefined();
    });

    it("should return null for ESM config", async () => {
      await writeFile(join(tempDir, "allurerc.mjs"), 'export default { name: "Test" }');

      const config = await readAllureConfig(tempDir);

      expect(config).toBeNull();
    });

    it("should return null when no config exists", async () => {
      const config = await readAllureConfig(tempDir);

      expect(config).toBeNull();
    });
  });

  describe("updateConfigPlugins", () => {
    it("should add a plugin to JSON config", async () => {
      const original = { name: "Test", plugins: { awesome: { options: {} } } };

      await writeFile(join(tempDir, "allurerc.json"), JSON.stringify(original));

      const updated = await updateConfigPlugins(tempDir, "dashboard", { options: {} });

      expect(updated).toBe(true);

      const config = await readAllureConfig(tempDir);

      expect(config?.plugins?.dashboard).toBeDefined();
      expect(config?.plugins?.awesome).toBeDefined();
    });

    it("should remove a plugin from JSON config", async () => {
      const original = { name: "Test", plugins: { awesome: { options: {} }, dashboard: { options: {} } } };

      await writeFile(join(tempDir, "allurerc.json"), JSON.stringify(original));

      const updated = await updateConfigPlugins(tempDir, "dashboard", null);

      expect(updated).toBe(true);

      const config = await readAllureConfig(tempDir);

      expect(config?.plugins?.dashboard).toBeUndefined();
      expect(config?.plugins?.awesome).toBeDefined();
    });

    it("should return false for ESM config", async () => {
      await writeFile(join(tempDir, "allurerc.mjs"), "export default {}");

      const updated = await updateConfigPlugins(tempDir, "dashboard", { options: {} });

      expect(updated).toBe(false);
    });

    it("should return false when no config exists", async () => {
      const updated = await updateConfigPlugins(tempDir, "dashboard", { options: {} });

      expect(updated).toBe(false);
    });
  });

  describe("updateConfigProperty", () => {
    it("should update a property in JSON config", async () => {
      await writeFile(join(tempDir, "allurerc.json"), JSON.stringify({ name: "Old Name" }));

      const updated = await updateConfigProperty(tempDir, "name", "New Name");

      expect(updated).toBe(true);

      const config = await readAllureConfig(tempDir);

      expect(config?.name).toBe("New Name");
    });

    it("should add a new property to JSON config", async () => {
      await writeFile(join(tempDir, "allurerc.json"), JSON.stringify({ name: "Test" }));

      const updated = await updateConfigProperty(tempDir, "output", "./custom-output");

      expect(updated).toBe(true);

      const config = await readAllureConfig(tempDir);

      expect(config?.output).toBe("./custom-output");
    });
  });

  describe("getConfigProperty", () => {
    it("should get an existing property", async () => {
      await writeFile(join(tempDir, "allurerc.json"), JSON.stringify({ name: "Test Report" }));

      const value = await getConfigProperty(tempDir, "name");

      expect(value).toBe("Test Report");
    });

    it("should return undefined for missing property", async () => {
      await writeFile(join(tempDir, "allurerc.json"), JSON.stringify({ name: "Test" }));

      const value = await getConfigProperty(tempDir, "output");

      expect(value).toBeUndefined();
    });

    it("should return undefined when no config exists", async () => {
      const value = await getConfigProperty(tempDir, "name");

      expect(value).toBeUndefined();
    });
  });
});
