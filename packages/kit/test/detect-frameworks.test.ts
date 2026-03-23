import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  detectFrameworks,
  detectFrameworksByFiles,
  detectInstalledAllurePackages,
} from "../src/utils/detect-frameworks.js";

describe("detect-frameworks", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "allure-kit-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("detectFrameworks (package.json)", () => {
    it("should detect vitest from devDependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          devDependencies: { vitest: "^2.0.0" },
        }),
      );

      const detected = await detectFrameworks(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("vitest");
      expect(detected[0].framework.adapterPackage).toBe("allure-vitest");
      expect(detected[0].source).toBe("devDependencies");
      expect(detected[0].version).toBe("^2.0.0");
    });

    it("should detect multiple frameworks", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          devDependencies: {
            "vitest": "^2.0.0",
            "@playwright/test": "^1.40.0",
          },
        }),
      );

      const detected = await detectFrameworks(tempDir);
      const ids = detected.map((d) => d.framework.id);

      expect(ids).toContain("vitest");
      expect(ids).toContain("playwright");
    });

    it("should detect framework from dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: { jest: "^29.0.0" },
        }),
      );

      const detected = await detectFrameworks(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("jest");
      expect(detected[0].source).toBe("dependencies");
    });

    it("should detect newman from devDependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          devDependencies: { newman: "^6.0.0" },
        }),
      );

      const detected = await detectFrameworks(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("newman");
      expect(detected[0].framework.adapterPackage).toBe("newman-reporter-allure");
    });

    it("should return empty array when no package.json exists", async () => {
      const detected = await detectFrameworks(tempDir);

      expect(detected).toHaveLength(0);
    });

    it("should return empty array when no frameworks found in package.json", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          devDependencies: { typescript: "^5.0.0" },
        }),
      );

      const detected = await detectFrameworks(tempDir);

      expect(detected).toHaveLength(0);
    });
  });

  describe("detectFrameworksByFiles", () => {
    it("should detect vitest by config file", async () => {
      await writeFile(join(tempDir, "vitest.config.ts"), "export default {}");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("vitest");
      expect(detected[0].source).toBe("config-file");
      expect(detected[0].version).toBe("unknown");
    });

    it("should detect playwright by config file", async () => {
      await writeFile(join(tempDir, "playwright.config.ts"), "export default {}");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("playwright");
      expect(detected[0].source).toBe("config-file");
    });

    it("should detect jest by config file", async () => {
      await writeFile(join(tempDir, "jest.config.js"), "module.exports = {}");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("jest");
      expect(detected[0].source).toBe("config-file");
    });

    it("should detect cypress by config file", async () => {
      await writeFile(join(tempDir, "cypress.config.ts"), "export default {}");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("cypress");
      expect(detected[0].source).toBe("config-file");
    });

    it("should detect mocha by config file", async () => {
      await writeFile(join(tempDir, ".mocharc.yml"), "spec: test");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("mocha");
      expect(detected[0].source).toBe("config-file");
    });

    it("should detect cucumberjs by config file", async () => {
      await writeFile(join(tempDir, "cucumber.js"), "module.exports = {}");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("cucumberjs");
      expect(detected[0].source).toBe("config-file");
    });

    it("should detect codeceptjs by config file", async () => {
      await writeFile(join(tempDir, "codecept.conf.js"), "module.exports = {}");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("codeceptjs");
      expect(detected[0].source).toBe("config-file");
    });

    it("should detect jasmine by config file", async () => {
      const jasmineDir = join(tempDir, "spec", "support");

      await mkdir(jasmineDir, { recursive: true });
      await writeFile(join(jasmineDir, "jasmine.json"), "{}");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("jasmine");
      expect(detected[0].source).toBe("config-file");
    });

    it("should detect cucumberjs by .feature files", async () => {
      const featuresDir = join(tempDir, "features");

      await mkdir(featuresDir, { recursive: true });
      await writeFile(join(featuresDir, "login.feature"), "Feature: Login");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("cucumberjs");
      expect(detected[0].source).toBe("test-files");
    });

    it("should detect cypress by .cy.ts test files", async () => {
      const cypressDir = join(tempDir, "cypress", "e2e");

      await mkdir(cypressDir, { recursive: true });
      await writeFile(join(cypressDir, "login.cy.ts"), "describe('Login', () => {})");

      const detected = await detectFrameworksByFiles(tempDir);
      const ids = detected.map((d) => d.framework.id);

      expect(ids).toContain("cypress");

      const cypress = detected.find((d) => d.framework.id === "cypress");

      expect(cypress?.source).toBe("test-files");
    });

    it("should detect newman by .postman_collection.json files", async () => {
      await writeFile(join(tempDir, "api.postman_collection.json"), JSON.stringify({ info: { name: "API" } }));

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("newman");
      expect(detected[0].source).toBe("test-files");
    });

    it("should detect multiple frameworks by config files", async () => {
      await writeFile(join(tempDir, "vitest.config.ts"), "export default {}");
      await writeFile(join(tempDir, "playwright.config.ts"), "export default {}");

      const detected = await detectFrameworksByFiles(tempDir);
      const ids = detected.map((d) => d.framework.id);

      expect(ids).toContain("vitest");
      expect(ids).toContain("playwright");
    });

    it("should prefer config-file over test-files detection", async () => {
      await writeFile(join(tempDir, "vitest.config.ts"), "export default {}");

      const testDir = join(tempDir, "test");

      await mkdir(testDir, { recursive: true });
      await writeFile(join(testDir, "example.test.ts"), "test('ok', () => {})");

      const detected = await detectFrameworksByFiles(tempDir);
      const vitest = detected.filter((d) => d.framework.id === "vitest");

      expect(vitest).toHaveLength(1);
      expect(vitest[0].source).toBe("config-file");
    });

    it("should not scan node_modules", async () => {
      const nmDir = join(tempDir, "node_modules", "some-pkg");

      await mkdir(nmDir, { recursive: true });
      await writeFile(join(nmDir, "test.feature"), "Feature: Skip");

      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(0);
    });

    it("should return empty array when no files found", async () => {
      const detected = await detectFrameworksByFiles(tempDir);

      expect(detected).toHaveLength(0);
    });
  });

  describe("detectFrameworks (combined)", () => {
    it("should merge deps and file detection without duplicates", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          devDependencies: { vitest: "^2.0.0" },
        }),
      );
      await writeFile(join(tempDir, "vitest.config.ts"), "export default {}");
      await writeFile(join(tempDir, "playwright.config.ts"), "export default {}");

      const detected = await detectFrameworks(tempDir);

      const vitest = detected.filter((d) => d.framework.id === "vitest");

      expect(vitest).toHaveLength(1);
      expect(vitest[0].source).toBe("devDependencies");

      const pw = detected.filter((d) => d.framework.id === "playwright");

      expect(pw).toHaveLength(1);
      expect(pw[0].source).toBe("config-file");
    });

    it("should detect frameworks only by files when no package.json", async () => {
      await writeFile(join(tempDir, "playwright.config.ts"), "export default {}");

      const detected = await detectFrameworks(tempDir);

      expect(detected).toHaveLength(1);
      expect(detected[0].framework.id).toBe("playwright");
      expect(detected[0].source).toBe("config-file");
    });
  });

  describe("detectInstalledAllurePackages", () => {
    it("should find allure packages in dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: { allure: "^3.0.0" },
          devDependencies: {
            "allure-vitest": "^3.0.0",
            "@allurereport/plugin-awesome": "^3.0.0",
            "typescript": "^5.0.0",
          },
        }),
      );

      const packages = await detectInstalledAllurePackages(tempDir);

      expect(packages).toHaveLength(3);

      const names = packages.map((pkg) => pkg.name);

      expect(names).toContain("allure");
      expect(names).toContain("allure-vitest");
      expect(names).toContain("@allurereport/plugin-awesome");
    });

    it("should correctly identify dev vs prod dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: { allure: "^3.0.0" },
          devDependencies: { "allure-vitest": "^3.0.0" },
        }),
      );

      const packages = await detectInstalledAllurePackages(tempDir);
      const allurePkg = packages.find((pkg) => pkg.name === "allure");
      const adapterPkg = packages.find((pkg) => pkg.name === "allure-vitest");

      expect(allurePkg?.isDev).toBe(false);
      expect(adapterPkg?.isDev).toBe(true);
    });

    it("should detect newman-reporter-allure as an allure package", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          devDependencies: { "newman-reporter-allure": "^3.0.0" },
        }),
      );

      const packages = await detectInstalledAllurePackages(tempDir);

      expect(packages).toHaveLength(1);
      expect(packages[0].name).toBe("newman-reporter-allure");
    });

    it("should return empty array when no package.json exists", async () => {
      const packages = await detectInstalledAllurePackages(tempDir);

      expect(packages).toHaveLength(0);
    });
  });
});
