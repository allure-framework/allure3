import { describe, expect, it } from "vitest";

import {
  findFrameworkByPackageName,
  findReportPluginById,
  FRAMEWORK_REGISTRY,
  getDefaultReportPlugins,
  REPORT_PLUGIN_REGISTRY,
} from "../../src/commands/kit/utils/registry.js";

describe("kit/registry", () => {
  describe("FRAMEWORK_REGISTRY", () => {
    it("should contain all expected frameworks", () => {
      const frameworkIds = FRAMEWORK_REGISTRY.map((framework) => framework.id);

      expect(frameworkIds).toContain("vitest");
      expect(frameworkIds).toContain("playwright");
      expect(frameworkIds).toContain("jest");
      expect(frameworkIds).toContain("mocha");
      expect(frameworkIds).toContain("cypress");
      expect(frameworkIds).toContain("cucumberjs");
      expect(frameworkIds).toContain("jasmine");
      expect(frameworkIds).toContain("codeceptjs");
      expect(frameworkIds).toContain("newman");
    });

    it("should have unique ids", () => {
      const ids = FRAMEWORK_REGISTRY.map((framework) => framework.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have unique adapter packages", () => {
      const adapters = FRAMEWORK_REGISTRY.map((framework) => framework.adapterPackage);
      const uniqueAdapters = new Set(adapters);

      expect(uniqueAdapters.size).toBe(adapters.length);
    });
  });

  describe("REPORT_PLUGIN_REGISTRY", () => {
    it("should contain all expected plugins", () => {
      const pluginIds = REPORT_PLUGIN_REGISTRY.map((plugin) => plugin.id);

      expect(pluginIds).toContain("awesome");
      expect(pluginIds).toContain("classic");
      expect(pluginIds).toContain("dashboard");
      expect(pluginIds).toContain("csv");
      expect(pluginIds).toContain("log");
      expect(pluginIds).toContain("slack");
      expect(pluginIds).toContain("jira");
      expect(pluginIds).toContain("testops");
      expect(pluginIds).toContain("allure2");
      expect(pluginIds).toContain("testplan");
      expect(pluginIds).toContain("progress");
    });

    it("should have unique ids", () => {
      const ids = REPORT_PLUGIN_REGISTRY.map((plugin) => plugin.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have at least one default plugin", () => {
      const defaults = REPORT_PLUGIN_REGISTRY.filter((plugin) => plugin.isDefault);

      expect(defaults.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("findFrameworkByPackageName", () => {
    it("should find vitest by package name", () => {
      const result = findFrameworkByPackageName("vitest");

      expect(result).toBeDefined();
      expect(result?.id).toBe("vitest");
      expect(result?.adapterPackage).toBe("allure-vitest");
    });

    it("should find playwright by package name", () => {
      const result = findFrameworkByPackageName("@playwright/test");

      expect(result).toBeDefined();
      expect(result?.id).toBe("playwright");
    });

    it("should find newman by package name", () => {
      const result = findFrameworkByPackageName("newman");

      expect(result).toBeDefined();
      expect(result?.id).toBe("newman");
      expect(result?.adapterPackage).toBe("newman-reporter-allure");
    });

    it("should return undefined for unknown package", () => {
      const result = findFrameworkByPackageName("unknown-framework");

      expect(result).toBeUndefined();
    });
  });

  describe("findReportPluginById", () => {
    it("should find awesome plugin by id", () => {
      const result = findReportPluginById("awesome");

      expect(result).toBeDefined();
      expect(result?.packageName).toBe("@allurereport/plugin-awesome");
    });

    it("should return undefined for unknown plugin", () => {
      const result = findReportPluginById("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("getDefaultReportPlugins", () => {
    it("should return awesome as a default plugin", () => {
      const defaults = getDefaultReportPlugins();
      const defaultIds = defaults.map((plugin) => plugin.id);

      expect(defaultIds).toContain("awesome");
    });
  });
});
