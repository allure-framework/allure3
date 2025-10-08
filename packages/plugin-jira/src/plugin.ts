import type { Statistic, TestResult } from "@allurereport/core-api";
import { getWorstStatus, statusesList } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext, TestResultFilter } from "@allurereport/plugin-api";
import axios, { isAxiosError } from "axios";
import { isJiraIssueKey, prepareTestResults } from "./helpers.js";
import type {
  ClearPayload,
  ForgeAppOperations,
  ForgeAppRequest,
  ForgeAppVersions,
  UploadReportPayload,
} from "./types.js";

const TRUE_VALUES = ["true", "1"];

export interface JiraPluginOptions {
  /**
   * Url to the Allure Forge App webhook
   * @example "https://95f453e..."
   */
  webhook?: string;
  /**
   * Generated Atlassian API token
   * @example "dmR2dWto..."
   */
  token?: string;
  /**
   * Issue key from Jira to link report to
   * @example "JIRA-123"
   */
  issue?: string;
  /**
   * Whether to upload the report
   * @example true
   */
  uploadReport?: boolean;
  /**
   * Whether to upload the results
   * @example true
   */
  uploadResults?: boolean;
}

export class JiraPlugin implements Plugin {
  constructor(readonly options: JiraPluginOptions = {}) {}

  #pluginName = "Allure Jira Plugin";

  get #pluginOptions() {
    return {
      token: this.options.token || process.env.ALLURE_JIRA_TOKEN,
      webhook: this.options.webhook || process.env.ALLURE_JIRA_WEBHOOK,
      reportIssue: this.options.issue ?? process.env.ALLURE_JIRA_ISSUE,
      uploadReport: this.options.uploadReport ?? TRUE_VALUES.includes(process.env.ALLURE_JIRA_UPLOAD_REPORT ?? ""),
      uploadResults: this.options.uploadResults ?? TRUE_VALUES.includes(process.env.ALLURE_JIRA_UPLOAD_RESULTS ?? ""),
    };
  }

  #reportTestResults: TestResult[] = [];

  async #getReportTestResults(store: AllureStore) {
    // Use cached results if they are available
    if (this.#reportTestResults.length > 0) {
      return this.#reportTestResults;
    }

    this.#reportTestResults = await store.allTestResults();

    return this.#reportTestResults;
  }

  #globalReportStatistic: Partial<Statistic> = {};

  async reportTestsStatistic(store: AllureStore, filter?: TestResultFilter): Promise<Statistic> {
    // Use cached unfiltered statistic if it is available
    if (!filter && this.#globalReportStatistic.total !== undefined) {
      return this.#globalReportStatistic as Statistic;
    }

    const trs = await this.#getReportTestResults(store);
    const statistic: Statistic = { total: 0 };

    for (const tr of trs) {
      // This is okay because retriesByTr has no async operations
      const retries = await store.retriesByTr(tr);

      if (filter && !filter(tr)) {
        continue;
      }

      statistic.total++;

      if (retries.length > 0) {
        statistic.retries = (statistic.retries ?? 0) + 1;
      }

      if (tr.flaky) {
        statistic.flaky = (statistic.flaky ?? 0) + 1;
      }

      if (tr.transition === "new") {
        statistic.new = (statistic.new ?? 0) + 1;
      }

      if (!statistic[tr.status]) {
        statistic[tr.status] = 0;
      }

      statistic[tr.status]!++;
    }

    if (!filter) {
      this.#globalReportStatistic = statistic;
    }

    return statistic;
  }

  #verifyOptions() {
    const { token, webhook } = this.#pluginOptions;

    if (!token) {
      throw new Error(`[${this.#pluginName}] token is not set`);
    }
    if (!webhook) {
      throw new Error(`[${this.#pluginName}] webhook is not set`);
    }
  }

  async #requestForgeApp(props: {
    operation: ForgeAppOperations;
    payload: Record<string, unknown>;
    version?: ForgeAppVersions;
  }) {
    const { operation, payload, version = "v1" } = props;
    const { token, webhook } = this.#pluginOptions;

    const requestData: ForgeAppRequest = {
      operation,
      version,
      payload,
      token: token!,
    };

    try {
      await axios.post(webhook!, requestData);
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`[${this.#pluginName}] Allure Jira Integration app error: ${errorMessage}`);
      }
      throw error;
    }
  }

  async #uploadResults(context: PluginContext, store: AllureStore) {
    const allTestResults = await this.#getReportTestResults(store);

    if (allTestResults.length === 0) {
      throw new Error(`[${this.#pluginName}] no test results found`);
    }

    const testResults = prepareTestResults(allTestResults);

    const payload = {
      results: testResults,
      reportUrl: context.reportUrl,
    };

    await this.#requestForgeApp({ operation: "upload-results", payload });
  }

  async #getReportStatus(store: AllureStore) {
    const reportStatistic = await this.reportTestsStatistic(store);
    const globalErrors = await store.allGlobalErrors();
    const globalExitCode = await store.globalExitCode();
    const code = globalExitCode?.actual ?? globalExitCode?.original;
    const hasGlobalErrors = globalErrors.length > 0;

    if (hasGlobalErrors) {
      return "failed";
    }

    if (code === 0) {
      return "passed";
    }

    const worstStatus =
      getWorstStatus(
        statusesList
          .map((status) => {
            const value = reportStatistic[status] ?? 0;
            return value > 0 ? status : undefined;
          })
          .filter((status) => status !== undefined),
      ) ?? "passed";

    if (worstStatus === "passed") {
      return "passed";
    }

    return "failed";
  }

  async #getStatisticByEnv(store: AllureStore) {
    const statisticByEnv: Record<string, Statistic> = {};
    const envs = await store.allEnvironments();

    for (const env of envs) {
      statisticByEnv[env] = await this.reportTestsStatistic(store, (tr) => tr.environment === env);
    }

    return statisticByEnv;
  }

  async #getCiInfo(context: PluginContext) {
    const jobUrl = context.ci?.pullRequestUrl ?? context.ci?.jobUrl ?? context.ci?.jobRunUrl;
    const jobLabel = context.ci?.pullRequestName ?? context.ci?.jobName ?? context.ci?.jobRunName;

    return { url: jobUrl, label: jobLabel };
  }

  async #getReportDate(store: AllureStore) {
    const trs = await this.#getReportTestResults(store);
    return trs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);
  }

  async #uploadReport(context: PluginContext, store: AllureStore) {
    const { reportIssue } = this.#pluginOptions;

    if (!reportIssue) {
      throw new Error(`[${this.#pluginName}] reportIssue is not set`);
    }

    if (!isJiraIssueKey(reportIssue)) {
      throw new Error(`[${this.#pluginName}] reportIssue is not a valid Jira issue key`);
    }

    const statistic = await this.reportTestsStatistic(store);

    if (statistic.total === 0) {
      throw new Error(`[${this.#pluginName}] no test results found`);
    }

    const history = await store.allHistoryDataPoints();
    const reportStatus = await this.#getReportStatus(store);
    const statisticByEnv = await this.#getStatisticByEnv(store);
    const date = await this.#getReportDate(store);
    const ciInfo = await this.#getCiInfo(context);

    const payload: UploadReportPayload = {
      issue: reportIssue,
      report: {
        id: context.reportUuid,
        history: history.map(({ uuid }) => uuid),
        status: reportStatus,
        name: context.reportName,
        url: context.reportUrl,
        date,
        ciInfo: ciInfo.url ? { url: ciInfo.url, label: ciInfo.label } : undefined,
        statistic,
        statisticByEnv,
      },
    };

    await this.#requestForgeApp({ operation: "upload-report", payload });
  }

  async #uploadAll(context: PluginContext, store: AllureStore) {
    await this.#uploadReport(context, store);

    await this.#uploadResults(context, store);
  }

  /**
   * Unlink reports from the specified Jira issue
   * @param issues Jira issue key(s)
   * @example clearReports(["JIRA-123", "JIRA-456"])
   */
  async clearReports(issues: string[]) {
    const payload: ClearPayload = { issues, reports: true };
    return await this.#requestForgeApp({ operation: "clear", payload });
  }

  /**
   * Unlink test results from the specified Jira issue
   * @param issues Jira issue key(s)
   * @example clearResults(["JIRA-123", "JIRA-456"])
   */
  async clearResults(issues: string[]) {
    return await this.#requestForgeApp({ operation: "clear", payload: { issues, results: true } });
  }

  /**
   * Unlink reports and test results from the specified Jira issue
   * @param issues Jira issue key(s)
   * @example clearAll(["JIRA-123", "JIRA-456"])
   */
  async clearAll(issues: string[]) {
    const payload: ClearPayload = { issues, reports: true, results: true };
    return await this.#requestForgeApp({ operation: "clear", payload });
  }

  async done(context: PluginContext, store: AllureStore) {
    this.#verifyOptions();
    const { uploadReport, uploadResults } = this.#pluginOptions;

    if (!uploadReport && !uploadResults) {
      throw new Error(`[${this.#pluginName}] Set at least one of the options: uploadReport or uploadResults`);
    }

    if (uploadReport && uploadResults) {
      await this.#uploadAll(context, store);
      return;
    }

    if (uploadReport) {
      await this.#uploadReport(context, store);
      return;
    }

    if (uploadResults) {
      await this.#uploadResults(context, store);
      return;
    }
  }
}
