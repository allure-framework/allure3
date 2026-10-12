import type { TestStatus } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";

import { XrayClient, formatXrayError } from "./client.js";
import {
  DEFAULT_STATUSES,
  XRAY_STATUSES,
  collectStatuses,
  escapeWikiLinkText,
  isXrayStatus,
  splitList,
  uniq,
} from "./helpers.js";
import type { XrayStatus, XrayTestRun } from "./types.js";

export type { XrayStatus } from "./types.js";

export interface XrayPluginOptions {
  /**
   * Base url of Jira with Xray installed (Server / Data Center)
   * @example "https://jira.example.com"
   */
  endpoint?: string;
  /**
   * Jira username (basic auth)
   */
  username?: string;
  /**
   * Jira password (basic auth)
   */
  password?: string;
  /**
   * Personal access token, used instead of username and password when set
   */
  token?: string;
  /**
   * Keys of Test Executions whose test runs should be updated
   * @example ["XT-6", "XT-7"]
   */
  executions?: string[];
  /**
   * Override the Xray status set for an Allure test status
   * @example { skipped: "TODO", broken: "FAIL" }
   */
  statuses?: Partial<Record<TestStatus, XrayStatus>>;
  /**
   * Whether to comment on Test Executions with a link to the report. Requires the report url
   * @default true
   */
  comment?: boolean;
}

const STATUS_ENV: Record<TestStatus, string> = {
  passed: "ALLURE_XRAY_STATUS_PASSED",
  failed: "ALLURE_XRAY_STATUS_FAILED",
  broken: "ALLURE_XRAY_STATUS_BROKEN",
  skipped: "ALLURE_XRAY_STATUS_SKIPPED",
  unknown: "ALLURE_XRAY_STATUS_UNKNOWN",
};

export class XrayPlugin implements Plugin {
  constructor(readonly options: XrayPluginOptions = {}) {}

  #pluginName = "Allure Xray Plugin";

  get #pluginOptions() {
    const { options } = this;
    const statuses = { ...DEFAULT_STATUSES };

    for (const status of Object.keys(STATUS_ENV) as TestStatus[]) {
      const value = options.statuses?.[status] ?? process.env[STATUS_ENV[status]];
      if (value === undefined) {
        continue;
      }
      if (!isXrayStatus(value)) {
        throw new Error(
          `[${this.#pluginName}] unsupported Xray status "${value}" for "${status}", expected one of: ${XRAY_STATUSES.join(", ")}`,
        );
      }
      statuses[status] = value;
    }

    return {
      endpoint: options.endpoint || process.env.ALLURE_XRAY_ENDPOINT,
      username: options.username || process.env.ALLURE_XRAY_USERNAME,
      password: options.password || process.env.ALLURE_XRAY_PASSWORD,
      token: options.token || process.env.ALLURE_XRAY_TOKEN,
      executions: options.executions ? uniq(options.executions) : splitList(process.env.ALLURE_XRAY_EXECUTIONS ?? ""),
      comment: options.comment ?? !["false", "0"].includes(process.env.ALLURE_XRAY_COMMENT ?? ""),
      statuses,
    };
  }

  #createClient({
    endpoint,
    username,
    password,
    token,
  }: Pick<XrayPluginOptions, "endpoint" | "username" | "password" | "token">) {
    if (!endpoint) {
      throw new Error(`[${this.#pluginName}] endpoint is not set`);
    }
    if (!token && !(username && password)) {
      throw new Error(`[${this.#pluginName}] set either token or both username and password`);
    }

    return new XrayClient({ endpoint, username, password, token });
  }

  /**
   * Runs the action and logs a failure instead of throwing, so one failed request doesn't stop the others
   * @returns whether the action succeeded
   */
  async #attempt(description: string, action: () => Promise<void>) {
    try {
      await action();
      return true;
    } catch (error) {
      console.error(`[${this.#pluginName}] failed to ${description}: ${formatXrayError(error)}`);
      return false;
    }
  }

  async #syncExecution(client: XrayClient, execution: string, wanted: ReadonlyMap<string, XrayStatus>) {
    let runs: XrayTestRun[] = [];
    let synced = await this.#attempt(`read test runs of ${execution}`, async () => {
      runs = await client.getTestRuns(execution);
    });

    for (const run of runs) {
      const status = wanted.get(run.key);
      if (status && run.status !== status) {
        const updated = await this.#attempt(`update test run ${run.key} (id: ${run.id}) to ${status}`, () =>
          client.updateTestRunStatus(run.id, status),
        );
        synced &&= updated;
      }
    }

    return synced;
  }

  async done(context: PluginContext, store: AllureStore) {
    const opts = this.#pluginOptions;

    if (opts.executions.length === 0) {
      throw new Error(`[${this.#pluginName}] no Test Executions specified (executions / ALLURE_XRAY_EXECUTIONS)`);
    }

    const client = this.#createClient(opts);
    const wanted = collectStatuses(await store.allTestResults(), opts.statuses);

    if (wanted.size === 0) {
      return;
    }

    const comment = context.reportUrl
      ? `Execution updated from report [${escapeWikiLinkText(context.reportName)}|${context.reportUrl}]`
      : undefined;

    for (const execution of opts.executions) {
      const synced = await this.#syncExecution(client, execution, wanted);

      // don't claim the execution was updated when reading or updating its test runs failed
      if (synced && opts.comment && comment) {
        await this.#attempt(`comment on ${execution}`, () => client.addComment(execution, comment));
      }
    }
  }
}
