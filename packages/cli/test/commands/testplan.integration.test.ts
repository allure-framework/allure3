import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../../cli.js", import.meta.url));

describe("built testplan command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "allure-testplan-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes selected and muted tests from allure results", async () => {
    const resultsDir = join(tempDir, "allure-results");
    const outputPath = join(tempDir, "output", "custom-testplan.json");
    await mkdir(resultsDir);
    const results = [
      { uuid: "regular-failure", fullName: "suite#regularFailure", status: "failed", statusDetails: { muted: false } },
      { uuid: "muted-passed", fullName: "suite#mutedPassed", status: "passed", statusDetails: { muted: true } },
    ];
    await Promise.all(
      results.map((result) =>
        writeFile(
          join(resultsDir, `${result.uuid}-result.json`),
          JSON.stringify({ name: result.fullName, start: 1000, stop: 1001, ...result }),
        ),
      ),
    );
    const env = { ...process.env };
    delete env.ALLURE_CLI_ACTIVE_COMMAND;

    await execFileAsync(process.execPath, [cliPath, "testplan", resultsDir, "--output", outputPath], {
      cwd: tempDir,
      env,
    });
    const plan = JSON.parse(await readFile(outputPath, "utf-8"));

    expect(plan).toEqual({
      version: "1.0",
      tests: [{ selector: "suite#regularFailure" }],
      mutedTests: [{ selector: "suite#mutedPassed" }],
    });
  });
});
