import { exit } from "node:process";

import { createReportContext, type ReportContext } from "@allurereport/ci";
import type { FullConfig } from "@allurereport/core";
import { AllureReport } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { red } from "yoctocolors";

import { findFilesByGlobs } from "../../utils/fileSystem.js";
import { logError } from "../../utils/logs.js";
import { resolveAndFindResultsDirs, resolveResultsPatterns } from "../../utils/resultsPatterns.js";

export type GenerateResult = { summary?: ReportContext };

export const generate = async (params: {
  cwd: string;
  config: FullConfig;
  resultsDir?: string[];
  dump?: string[];
  collectSummary?: boolean;
}): Promise<GenerateResult | undefined> => {
  const dumpFiles: string[] = params?.dump?.length ? await findFilesByGlobs(params.cwd, params.dump) : [];
  const cliPatterns = params.resultsDir ?? [];
  const resolvedPatterns = resolveResultsPatterns(cliPatterns, params.config.resultsDir);
  // dumps-only: skip default results read only when CLI empty AND config unset AND dumps present
  const shouldReadResults = resolvedPatterns.length > 0 || dumpFiles.length === 0;
  const { resultDirectories = [], patterns = resolvedPatterns } = shouldReadResults
    ? await resolveAndFindResultsDirs(params.cwd, cliPatterns, params.config.resultsDir)
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

    if (!params.collectSummary) {
      return;
    }

    const result: GenerateResult = {};

    try {
      const summary = await createReportContext(params.config.output, {
        // eslint-disable-next-line no-console
        onError: (message) => console.warn(message),
      });

      if (!summary.testResults && summary.reports.length === 0) {
        throw new Error("no report context data found");
      }

      result.summary = summary;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`Report summary skipped: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
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
