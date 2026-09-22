import { exit } from "node:process";

import type { FullConfig } from "@allurereport/core";
import { AllureReport } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { red } from "yoctocolors";

import { findFilesByGlobs } from "../../utils/fileSystem.js";
import { logError } from "../../utils/logs.js";
import { resolveAndFindResultsDirs, resolveResultsPatterns } from "../../utils/resultsPatterns.js";
import { collectReportSummary } from "./summary.js";

export type GenerateResult = { summary?: Awaited<ReturnType<typeof collectReportSummary>> };

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

    const result: GenerateResult | undefined = params.collectSummary ? {} : undefined;

    if (params.collectSummary) {
      try {
        result!.summary = await collectReportSummary(allureReport.store, params.config.name);
      } catch {
        // eslint-disable-next-line no-console
        console.warn("GitLab summary snapshot skipped: summary collection failed");
      }
    }

    await allureReport.done();

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
