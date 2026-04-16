import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { KitGhPagesInitCommand } from "../../src/commands/kit/ghPagesInit.js";
import { detectPackageManager } from "../../src/commands/kit/utils/detect-package-manager.js";

vi.mock("../../src/commands/kit/utils/detect-package-manager.js", () => ({
  detectPackageManager: vi.fn(),
}));

describe("kit/gh-pages-init", () => {
  it("should create a gh-pages workflow in the target cwd", async () => {
    vi.mocked(detectPackageManager).mockResolvedValue("yarn");

    const tempDir = await mkdtemp(join(tmpdir(), "allure-kit-gh-pages-"));

    try {
      const command = new KitGhPagesInitCommand();
      command.cwd = tempDir;
      command.yes = true;

      await command.execute();

      const workflowPath = join(tempDir, ".github", "workflows", "allure-gh-pages.yml");
      const workflow = await readFile(workflowPath, "utf-8");

      expect(workflow).toContain("name: Allure Report (GitHub Pages)");
      expect(workflow).toContain("publish_branch: gh-pages");
      expect(workflow).toContain("run: yarn test");
      expect(workflow).toContain("branches: [main]");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should respect --branch, --config, and --test-command", async () => {
    vi.mocked(detectPackageManager).mockResolvedValue("npm");

    const tempDir = await mkdtemp(join(tmpdir(), "allure-kit-gh-pages-"));

    try {
      const command = new KitGhPagesInitCommand();
      command.cwd = tempDir;
      command.yes = true;
      command.defaultBranch = "develop";
      command.allureConfig = "./allurerc.mjs";
      command.testCommand = "npm run test:e2e";

      await command.execute();

      const workflowPath = join(tempDir, ".github", "workflows", "allure-gh-pages.yml");
      const workflow = await readFile(workflowPath, "utf-8");

      expect(workflow).toContain("branches: [develop]");
      expect(workflow).toContain("run: npm run test:e2e");
      expect(workflow).toContain("npx allure generate --config=./allurerc.mjs --output ./allure-report");
      expect(workflow).toContain("run: npm ci");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
