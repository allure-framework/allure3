import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { readdir } from "node:fs/promises";
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
});
