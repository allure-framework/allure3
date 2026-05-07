import { exit } from "node:process";

import type { FullConfig } from "@allurereport/core";
import { AllureReport } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { red } from "yoctocolors";

import { searchAllureResultDirectories, searchFilesByGlobs } from "../../utils/fileSystem.js";
import { logError } from "../../utils/logs.js";

export const generate = async (params: { cwd: string; config: FullConfig; resultsDir: string[]; dump?: string[] }) => {
  const dumpFiles: string[] = params?.dump?.length ? await searchFilesByGlobs(params.cwd, params.dump) : [];

  // don't read allure results directories without the parameter when dump file has been found
  // or read allure results directory when it is explicitly provided
  const { resultDirectories = [], patterns = params.resultsDir } =
    !!params?.resultsDir || dumpFiles.length === 0
      ? await searchAllureResultDirectories(params.cwd, params.resultsDir)
      : {};

  if (resultDirectories.length === 0 && dumpFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.error(red(`No test results directories found matching pattern: ${patterns}`));
    exit(1);
    return;
  }

  try {
    const allureReport = new AllureReport(params.config);

    await allureReport.restoreState(Array.from(dumpFiles));
    await allureReport.start();

    for (const dir of resultDirectories) {
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
