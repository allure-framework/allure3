import type { CiDescriptor, TestResult } from "@allurereport/core-api";
import { collectGitHead } from "@allurereport/git";
import type {
  AllureStore,
  PluginContext,
  ReportExecutorInfo,
  ReportGitInfo,
  ReportRunSummary,
} from "@allurereport/plugin-api";
import { getRunSummary } from "@allurereport/plugin-api";

/**
 * The data of the classic Overview page that goes into the report options:
 * the run dates for the summary widget, the executor and the CI/git information
 */
export type ClassicOverviewOptions = {
  ci: CiDescriptor | undefined;
  git: ReportGitInfo | undefined;
  executor: ReportExecutorInfo | undefined;
  runSummary: ReportRunSummary | undefined;
};

export const collectOverviewOptions = async (
  context: Pick<PluginContext, "ci">,
  store: Pick<AllureStore, "metadataByKey">,
  testResults: Pick<TestResult, "start" | "stop">[],
  gitHead: () => ReportGitInfo | undefined = collectGitHead,
): Promise<ClassicOverviewOptions> => {
  const executor = await store.metadataByKey<ReportExecutorInfo>("allure2_executor");

  return {
    ci: context.ci,
    git: gitHead(),
    executor: executor ?? undefined,
    runSummary: getRunSummary(testResults),
  };
};
