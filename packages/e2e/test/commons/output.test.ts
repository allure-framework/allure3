import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";

import { AwesomePluginWithoutSummary, type ReportBootstrap, bootstrapReport } from "../utils/index.js";

test.describe("output", () => {
  let bootstrap: ReportBootstrap;

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test.beforeEach(async ({ browserName }) => {
    await label("env", browserName);
  });

  test("should generate single report in the report output directory without sub-directories", async () => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
        plugins: [
          {
            id: "awesome",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
        ],
      },
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
        },
      ],
    });

    const reportDirFiles = await readdir(bootstrap.reportDir, { withFileTypes: true });

    // usually output directory contains `index.html` summary file and directories for each plugin
    expect(reportDirFiles.length > 2).toBe(true);
    expect(reportDirFiles.find(({ name }) => name === "awesome")).toBeUndefined();
  });

  test("should generate summary page and sub-directories for every report", async () => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
        plugins: [
          {
            id: "awesome1",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
          {
            id: "awesome2",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
        ],
      },
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
        },
      ],
    });

    const reportDirFiles = await readdir(bootstrap.reportDir, { withFileTypes: true });

    // usually output directory contains `index.html` summary file and directories for each plugin
    expect(reportDirFiles.length).toBe(3);
    expect(reportDirFiles.find((dirent) => dirent.name === "index.html" && dirent.isFile())).not.toBeUndefined();
    expect(reportDirFiles.find((dirent) => dirent.name === "awesome1" && !dirent.isFile())).not.toBeUndefined();
    expect(reportDirFiles.find((dirent) => dirent.name === "awesome2" && !dirent.isFile())).not.toBeUndefined();
  });

  test("should not generate summary page if no one report provided summary, but still should generate sub-directories for every report", async () => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
        plugins: [
          {
            id: "awesome1",
            enabled: true,
            plugin: new AwesomePluginWithoutSummary({}),
            options: {},
          },
          {
            id: "awesome2",
            enabled: true,
            plugin: new AwesomePluginWithoutSummary({}),
            options: {},
          },
        ],
      },
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
        },
      ],
    });
    const reportDirFiles = await readdir(bootstrap.reportDir, { withFileTypes: true });

    // usually output directory contains `index.html` summary file and directories for each plugin
    expect(reportDirFiles.length).toBe(2);
    expect(reportDirFiles.find((dirent) => dirent.name === "index.html" && dirent.isFile())).toBeUndefined();
    expect(reportDirFiles.find((dirent) => dirent.name === "awesome1" && !dirent.isFile())).not.toBeUndefined();
    expect(reportDirFiles.find((dirent) => dirent.name === "awesome2" && !dirent.isFile())).not.toBeUndefined();
  });

  test("should keep attachment and static assets accessible for every awesome report without duplicating inode", async () => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
        plugins: [
          {
            id: "awesome1",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
          {
            id: "awesome2",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
        ],
      },
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
        },
      ],
      globals: {
        attachments: {
          "global-shared.txt": Buffer.from("global-shared-content", "utf8"),
        },
      },
    });

    const reportOneAssets = await readdir(resolve(bootstrap.reportDir, "awesome1"));
    const reportTwoAssets = await readdir(resolve(bootstrap.reportDir, "awesome2"));
    const reportOneAttachmentFiles = await readdir(resolve(bootstrap.reportDir, "awesome1", "data", "attachments"));
    const reportTwoAttachmentFiles = await readdir(resolve(bootstrap.reportDir, "awesome2", "data", "attachments"));
    const staticAssets = reportOneAssets.filter((assetName) => assetName.endsWith(".js") || assetName.endsWith(".css"));

    expect(staticAssets.length).toBeGreaterThan(0);
    expect(reportTwoAssets).toEqual(expect.arrayContaining(staticAssets));
    expect(reportOneAttachmentFiles).toHaveLength(1);
    expect(reportTwoAttachmentFiles).toHaveLength(1);
    expect(reportOneAttachmentFiles[0]).toBe(reportTwoAttachmentFiles[0]);

    const reportOneAttachmentPath = resolve(
      bootstrap.reportDir,
      "awesome1",
      "data",
      "attachments",
      reportOneAttachmentFiles[0],
    );
    const reportTwoAttachmentPath = resolve(
      bootstrap.reportDir,
      "awesome2",
      "data",
      "attachments",
      reportTwoAttachmentFiles[0],
    );

    expect(await readFile(reportOneAttachmentPath, "utf8")).toBe("global-shared-content");
    expect(await readFile(reportTwoAttachmentPath, "utf8")).toBe("global-shared-content");

    if (process.platform !== "win32") {
      const firstAttachmentStat = await stat(reportOneAttachmentPath);
      const secondAttachmentStat = await stat(reportTwoAttachmentPath);

      expect(firstAttachmentStat.ino).toBe(secondAttachmentStat.ino);
    }
  });
});
