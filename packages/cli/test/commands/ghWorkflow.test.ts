import { realpath } from "node:fs/promises";
import { PassThrough } from "node:stream";

import { readConfig } from "@allurereport/core";
import { type BaseContext, Cli } from "clipanion";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { GhWorkflowCommand } from "../../src/commands/ghWorkflow.js";

vi.mock("@allurereport/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/core")>()),
  readConfig: vi.fn(),
}));

const execute = async (...args: string[]) => {
  const cli = Cli.from([GhWorkflowCommand]);
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const out: string[] = [];
  const err: string[] = [];

  stdout.on("data", (chunk) => out.push(String(chunk)));
  stderr.on("data", (chunk) => err.push(String(chunk)));

  const exitCode = await cli.run(["gh-workflow", ...args], { stdout, stderr } satisfies Partial<BaseContext>);

  return { exitCode, stdout: out.join(""), stderr: err.join("") };
};

const config = (environments?: Record<string, { name?: string }>) =>
  vi.mocked(readConfig).mockResolvedValue({ environments } as never);

describe("gh-workflow command", () => {
  beforeEach(() => {
    vi.mocked(readConfig).mockReset();
  });

  it("prints the workflow jobs for the environments given with --env, without reading the config", async () => {
    const result = await execute("--env", "foo", "--environment", "bar", "--env", "baz");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain('environment: ["foo", "bar", "baz"]');
    expect(result.stdout).toContain("-- npm test");
    expect(readConfig).not.toHaveBeenCalled();
  });

  it("uses the environments from the config when --env is not given, and does not load plugins", async () => {
    config({ "ubuntu-latest": {}, "macos-latest": { name: "macOS" } });

    const result = await execute("--config", "./custom/allurerc.mjs");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('environment: ["ubuntu-latest", "macos-latest"]');
    expect(readConfig).toHaveBeenCalledWith(await realpath(process.cwd()), "./custom/allurerc.mjs", { plugins: {} });
  });

  it("passes --config to the generated allure commands", async () => {
    config({ a: {} });

    const result = await execute("--config", "./custom/allurerc.mjs");

    expect(result.stdout).toContain("npx allure run --config=./custom/allurerc.mjs --environment=");
    expect(result.stdout).toContain("npx allure generate --config=./custom/allurerc.mjs --dump=");
  });

  it("takes the test command after --", async () => {
    const result = await execute("--env", "foo", "--", "yarn", "test", "--grep", "a b");

    expect(result.stdout).toContain("-- yarn test --grep 'a b'");
  });

  it.each([
    ["no environments in the config", [], undefined, /no environments/i],
    ["empty environments in the config", [], {}, /no environments/i],
    ["an invalid --env", ["--env", "a/b"], undefined, /--environment/],
    ["a control character in the test command", ["--env", "a", "--", "npm", "x\ny"], undefined, /test command/],
  ])("reports %s on stderr only", async (_name, args, environments, message) => {
    config(environments);

    const result = await execute(...args);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(message);
  });

  it("reports a missing working directory on stderr only", async () => {
    config({ a: {} });

    const result = await execute("--cwd", "/definitely/not/here");

    expect(result).toMatchObject({ exitCode: 1, stdout: "" });
    expect(result.stderr).toMatch(/ENOENT/);
  });

  it("reports a config loading failure with its stack on stderr only", async () => {
    vi.mocked(readConfig).mockRejectedValue(new Error("boom"));

    const result = await execute();

    expect(result).toMatchObject({ exitCode: 1, stdout: "" });
    expect(result.stderr).toMatch(/Error: boom\n\s+at /);
  });
});
