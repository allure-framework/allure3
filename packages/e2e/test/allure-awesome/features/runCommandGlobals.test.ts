import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { expect, test } from "@playwright/test";
import { feature, parameter } from "allure-js-commons";

import { GlobalsPage, TestResultPage } from "../../pageObjects/index.js";
import { serveReport } from "../../utils/index.js";

const STDOUT_MESSAGE = "run-command-stdout";
const STDERR_MESSAGE = "run-command-stderr";
const FAILED_RUN_COMMAND_SCRIPT = `console.log("${STDOUT_MESSAGE}"); console.error("${STDERR_MESSAGE}"); process.exit(1);`;

test.describe("run command globals", () => {
  let globalsPage: GlobalsPage;
  let testResultPage: TestResultPage;
  let commandCwd: string;
  let reportOutput: string;

  test.beforeEach(async ({ page, browserName }) => {
    globalsPage = new GlobalsPage(page);
    testResultPage = new TestResultPage(page);

    await feature("Global data");
    await parameter("browser", browserName);

    commandCwd = await mkdtemp(path.resolve(tmpdir(), "allure-e2e-run-cwd-"));
    reportOutput = await mkdtemp(path.resolve(tmpdir(), "allure-e2e-run-report-"));
  });

  test.afterEach(async () => {
    if (commandCwd) {
      await rm(commandCwd, { recursive: true, force: true });
    }

    if (reportOutput) {
      await rm(reportOutput, { recursive: true, force: true });
    }
  });

  test("should attach stdout and stderr for a failed run command", async ({ page }) => {
    console.log("the test");
    let stdout = "";
    let stderr = "";
    const reportProcess = spawn(
      "yarn",
      ["allure", "run", "--cwd", commandCwd, "--output", reportOutput, "--", "node", "-e", FAILED_RUN_COMMAND_SCRIPT],
      {
        stdio: "pipe",
        shell: false,
      },
    );

    reportProcess.stdout.on("data", (data) => {
      stdout += data;
    });
    reportProcess.stderr.on("data", (data) => {
      stderr += data;
    });

    await new Promise((resolve) => {
      reportProcess.on("close", () => {
        resolve(undefined);
      });
    });

    expect(reportProcess.exitCode).toBe(1);
    expect(stdout).toContain(STDOUT_MESSAGE);
    expect(stderr).toContain(STDERR_MESSAGE);

    const server = await serveReport(reportOutput);

    try {
      await page.goto(server.url);

      await expect(globalsPage.globalAttachmentsTabLocator).toContainText("2");
      await globalsPage.globalAttachmentsTabLocator.click();

      await testResultPage.toggleAttachmentByTitle("stdout.txt");
      await testResultPage.toggleAttachmentByTitle("stderr.txt");

      await expect(testResultPage.codeAttachmentContentLocator).toHaveCount(2);
      await expect(testResultPage.codeAttachmentContentLocator.nth(0)).toContainText(STDOUT_MESSAGE);
      await expect(testResultPage.codeAttachmentContentLocator.nth(1)).toContainText(STDERR_MESSAGE);

      await globalsPage.attachScreenshot();
    } finally {
      await server.shutdown();
    }
  });
});
