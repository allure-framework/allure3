import { type Statistic } from "@allurereport/core-api";
import { type AllureStore, type Plugin, type PluginContext } from "@allurereport/plugin-api";
import axios, { isAxiosError } from "axios";
import { prepareTestResults } from "./helpers.js";
import type { ForgeAppOperations, ForgeAppVersions, UploadReportPayload } from "./types.js";

const TRUE_VALUES = ["true", "1"];

export interface JiraPluginOptions {
  /**
   * Url to the Allure Forge App webhook
   * @example "https://95f453e..."
   */
  webhook?: string;
  /**
   * Generated API token
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
    this.#verifyOptions();
    const { operation, payload, version = "v1" } = props;

    const { token, webhook } = this.#pluginOptions;

    try {
      await axios.post(webhook!, {
        operation,
        version,
        payload,
        token,
      });
    } catch (error) {
      if (isAxiosError(error)) {
        throw new Error(`[${this.#pluginName}] Allure Jira Integration app error: ${error.message}`);
      }
      throw error;
    }
  }

  async #uploadResults(context: PluginContext, store: AllureStore, returnData = false) {
    this.#verifyOptions();

    const statistic = await store.testsStatistic();

    if (statistic.total === 0) {
      throw new Error(`[${this.#pluginName}] no test results found`);
    }

    const testResults = prepareTestResults(await store.allTestResults());

    const payload = {
      results: testResults,
      reportUrl: context.reportUrl,
    };

    if (returnData) {
      return payload;
    }

    await this.#requestForgeApp({ operation: "upload-results", payload });
  }

  async #getReportStatus(store: AllureStore) {
    const globalErrors = await store.allGlobalErrors();
    const globalExitCode = await store.globalExitCode();
    const code = globalExitCode?.actual ?? globalExitCode?.original;
    const hasGlobalErrors = globalErrors.length > 0;

    return hasGlobalErrors ? "failed" : code === 0 ? "passed" : "failed";
  }

  async #getStatisticByEnv(store: AllureStore) {
    const statisticByEnv: Record<string, Statistic> = {};
    const envs = await store.allEnvironments();

    for (const env of envs) {
      statisticByEnv[env] = await store.testsStatistic((tr) => tr.environment === env);
    }

    return statisticByEnv;
  }

  async #getCiInfo(context: PluginContext) {
    const jobUrl = context.ci?.pullRequestUrl ?? context.ci?.jobUrl ?? context.ci?.jobRunUrl;
    const jobLabel = context.ci?.pullRequestName ?? context.ci?.jobName ?? context.ci?.jobRunName;

    return { url: jobUrl, label: jobLabel };
  }

  async #getReportDate(store: AllureStore) {
    const testResults = await store.allTestResults();
    return testResults.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);
  }

  async #uploadReport(context: PluginContext, store: AllureStore, returnData = false) {
    const { reportIssue } = this.#pluginOptions;

    this.#verifyOptions();

    if (!reportIssue) {
      throw new Error(`[${this.#pluginName}] issue is not set`);
    }

    const statistic = await store.testsStatistic();

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

    if (returnData) {
      return payload;
    }

    await this.#requestForgeApp({ operation: "upload-report", payload });
  }

  async #uploadAll(context: PluginContext, store: AllureStore) {
    this.#verifyOptions();
    const reportPayload = await this.#uploadReport(context, store, true);
    const resultsPayload = await this.#uploadResults(context, store, true);

    await this.#requestForgeApp({
      operation: "upload-all",
      payload: {
        ...reportPayload,
        results: resultsPayload?.results,
      },
    });
  }

  /**
   * Unlink reports from the specified Jira issue
   * @param issues Jira issue key(s)
   * @example clearReports(["JIRA-123", "JIRA-456"])
   */
  async clearReports(issues: string[]) {
    return await this.#requestForgeApp({ operation: "clear", payload: { issues, reports: true } });
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
    return await this.#requestForgeApp({ operation: "clear", payload: { issues, reports: true, results: true } });
  }

  async done(context: PluginContext, store: AllureStore) {
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
