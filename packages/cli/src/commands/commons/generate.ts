import type { FullConfig } from "@allurereport/core";
import { AllureReport } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { glob } from "glob";
import { exit } from "node:process";
import { red } from "yoctocolors";
import { logError } from "../../utils/logs.js";

export const generate = async (params: { cwd: string; config: FullConfig; resultsDir: string; stage?: string[] }) => {
  const stageDumpFiles: string[] = [];
  const resultsDirectories: string[] = [];

  if (params?.stage?.length) {
    for (const stage of params.stage) {
      const matchedFiles = await glob(stage, {
        nodir: true,
        dot: true,
        absolute: true,
        windowsPathsNoEscape: true,
        cwd: params.cwd,
      });

      stageDumpFiles.push(...matchedFiles);
    }
  }

  // don't read allure results directories without the parameter when stage file has been found
  // or read allure results directory when it is explicitly provided
  if (!!params?.resultsDir || stageDumpFiles.length === 0) {
    const matchedDirs = (
      await glob(params.resultsDir, {
        mark: true,
        nodir: false,
        absolute: true,
        dot: true,
        windowsPathsNoEscape: true,
        cwd: params.cwd,
      })
    ).filter((p) => /(\/|\\)$/.test(p));

    resultsDirectories.push(...matchedDirs);
  }

  if (resultsDirectories.length === 0 && stageDumpFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.error(red(`No test results directories found matching pattern: ${params.resultsDir}`));
    exit(1);
    return;
  }

  try {
    const allureReport = new AllureReport(params.config);

    await allureReport.restoreState(Array.from(stageDumpFiles));
    await allureReport.start();

    for (const dir of resultsDirectories) {
      await allureReport.readDirectory(dir);
    }

    await allureReport.done();
  } catch (error) {
    if (error instanceof KnownError) {
      // eslint-disable-next-line no-console
      console.error(red(error.message));
      exit(1);
      return;
    }

    await logError("Failed to generate report due to unexpected error", error as Error);
    exit(1);
  }
};
