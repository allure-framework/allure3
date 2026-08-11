import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const commandsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(commandsDir, "../../../..");
const cliPath = join(repoRoot, "packages", "cli", "cli.js");
const yarnRcPath = join(repoRoot, ".yarnrc.yml");

const workspaces = new Set<string>();

const resolveYarnInvocation = async () => {
  const { readFile, stat } = await import("node:fs/promises");
  const yarnRc = await readFile(yarnRcPath, "utf-8");
  const configuredYarnPath = /^yarnPath:\s+(.+)$/m.exec(yarnRc)?.[1]?.trim();

  if (configuredYarnPath) {
    const resolvedYarnPath = resolve(repoRoot, configuredYarnPath);

    try {
      await stat(resolvedYarnPath);

      return {
        command: process.execPath,
        args: [resolvedYarnPath],
      };
    } catch {
      // fall through
    }
  }

  return {
    command: process.platform === "win32" ? "yarn.cmd" : "yarn",
    args: [],
  };
};

const waitForOutput = (pattern: RegExp, stdout: NodeJS.ReadableStream | null, timeoutMs = 30_000) =>
  new Promise<string>((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${pattern}`));
    }, timeoutMs);

    const onData = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (pattern.test(output)) {
        cleanup();
        resolve(output);
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      stdout?.off("data", onData);
      stdout?.off("error", onError);
    };

    stdout?.on("data", onData);
    stdout?.on("error", onError);
  });

afterEach(async () => {
  await Promise.all(
    [...workspaces].map(async (workspace) => {
      await rm(workspace, { recursive: true, force: true });
    }),
  );
  workspaces.clear();
});

describe("open command integration", () => {
  beforeEach(async () => {
    await epic("coverage");
    await feature("cli-commands");
    await story("open.integration");
    await label("coverage", "cli-commands");
  });

  it("serve with historyPath keeps the HTTP server running", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "allure-serve-history-"));
    workspaces.add(workspace);

    await mkdir(join(workspace, "allure-results"), { recursive: true });
    await writeFile(
      join(workspace, "allure-results", "x-result.json"),
      `${JSON.stringify({
        uuid: "11111111-1111-1111-1111-111111111111",
        historyId: "abc",
        name: "dummy test",
        status: "passed",
        stage: "finished",
        start: 1_784_900_000_000,
        stop: 1_784_900_001_000,
        labels: [],
        steps: [],
        parameters: [],
        links: [],
      })}\n`,
      "utf-8",
    );
    await writeFile(
      join(workspace, "allurerc.mjs"),
      `export default {
  name: "repro",
  historyPath: "./allure-history.jsonl",
};
`,
      "utf-8",
    );

    const yarnInvocation = await resolveYarnInvocation();
    const child = spawn(
      yarnInvocation.command,
      [...yarnInvocation.args, "node", cliPath, "serve", "allure-results", "--cwd", workspace],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_NO_WARNINGS: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    try {
      const output = await waitForOutput(/Allure is running on http:\/\/localhost:\d+/, child.stdout);
      expect(output).toMatch(/Allure is running on http:\/\/localhost:\d+/);
      expect(child.killed).toBe(false);
    } finally {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5_000).unref();
      });
    }
  }, 60_000);
});
