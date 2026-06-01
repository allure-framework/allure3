import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  detectPackageManager,
  getInstallCommand,
  getRemoveCommand,
} from "../../src/commands/kit/utils/detect-package-manager.js";

describe("kit/detect-package-manager", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "allure-kit-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("detectPackageManager", () => {
    it("should detect yarn when yarn.lock exists", async () => {
      await writeFile(join(tempDir, "yarn.lock"), "");

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("yarn");
    });

    it("should detect pnpm when pnpm-lock.yaml exists", async () => {
      await writeFile(join(tempDir, "pnpm-lock.yaml"), "");

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("pnpm");
    });

    it("should detect npm when package-lock.json exists", async () => {
      await writeFile(join(tempDir, "package-lock.json"), "{}");

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("npm");
    });

    it("should default to npm when no lockfile exists", async () => {
      const result = await detectPackageManager(tempDir);

      expect(result).toBe("npm");
    });

    it("should detect bun when bun.lockb exists", async () => {
      await writeFile(join(tempDir, "bun.lockb"), "");

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("bun");
    });

    it("should detect bun when bun.lock exists", async () => {
      await writeFile(join(tempDir, "bun.lock"), "");

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("bun");
    });

    it("should prefer bun over yarn when both lockfiles exist", async () => {
      await writeFile(join(tempDir, "bun.lockb"), "");
      await writeFile(join(tempDir, "yarn.lock"), "");

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("bun");
    });

    it("should prefer yarn over npm when both lockfiles exist", async () => {
      await writeFile(join(tempDir, "yarn.lock"), "");
      await writeFile(join(tempDir, "package-lock.json"), "{}");

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("yarn");
    });

    it("should detect yarn from packageManager field in package.json", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ packageManager: "yarn@4.5.1" }));

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("yarn");
    });

    it("should detect pnpm from packageManager field in package.json", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ packageManager: "pnpm@9.0.0" }));

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("pnpm");
    });

    it("should detect bun from packageManager field in package.json", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ packageManager: "bun@1.1.0" }));

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("bun");
    });

    it("should find yarn.lock in a parent directory", async () => {
      await writeFile(join(tempDir, "yarn.lock"), "");

      const subDir = join(tempDir, "packages", "my-app");

      await mkdir(subDir, { recursive: true });

      const result = await detectPackageManager(subDir);

      expect(result).toBe("yarn");
    });

    it("should find packageManager field in a parent package.json", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ packageManager: "pnpm@9.0.0" }));

      const subDir = join(tempDir, "packages", "my-app");

      await mkdir(subDir, { recursive: true });

      const result = await detectPackageManager(subDir);

      expect(result).toBe("pnpm");
    });

    it("should prefer packageManager field over lockfile in same directory", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ packageManager: "yarn@4.5.1" }));
      await writeFile(join(tempDir, "package-lock.json"), "{}");

      const result = await detectPackageManager(tempDir);

      expect(result).toBe("yarn");
    });
  });

  describe("getInstallCommand", () => {
    it("should generate yarn dev install command", () => {
      const command = getInstallCommand("yarn", ["allure", "allure-vitest"], true);

      expect(command).toBe("yarn add -D allure allure-vitest");
    });

    it("should generate npm dev install command", () => {
      const command = getInstallCommand("npm", ["allure"], true);

      expect(command).toBe("npm install --save-dev allure");
    });

    it("should generate pnpm dev install command", () => {
      const command = getInstallCommand("pnpm", ["allure"], true);

      expect(command).toBe("pnpm add -D allure");
    });

    it("should generate npm prod install command", () => {
      const command = getInstallCommand("npm", ["allure"], false);

      expect(command).toBe("npm install allure");
    });

    it("should generate bun dev install command", () => {
      const command = getInstallCommand("bun", ["allure", "allure-vitest"], true);

      expect(command).toBe("bun add -d allure allure-vitest");
    });

    it("should generate bun prod install command", () => {
      const command = getInstallCommand("bun", ["allure"], false);

      expect(command).toBe("bun add allure");
    });
  });

  describe("getRemoveCommand", () => {
    it("should generate yarn remove command", () => {
      const command = getRemoveCommand("yarn", ["allure-vitest"]);

      expect(command).toBe("yarn remove allure-vitest");
    });

    it("should generate npm uninstall command", () => {
      const command = getRemoveCommand("npm", ["allure-vitest"]);

      expect(command).toBe("npm uninstall allure-vitest");
    });

    it("should generate pnpm remove command", () => {
      const command = getRemoveCommand("pnpm", ["allure-vitest"]);

      expect(command).toBe("pnpm remove allure-vitest");
    });

    it("should generate bun remove command", () => {
      const command = getRemoveCommand("bun", ["allure-vitest"]);

      expect(command).toBe("bun remove allure-vitest");
    });
  });
});
