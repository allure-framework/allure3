import { env } from "node:process";

import { applyAllureCiEnv, detect, isLocalCiDescriptor } from "@allurereport/ci";
import { getGlobalLogLevel } from "@allurereport/cli-commons";
import type { CiDescriptor, EnvironmentIdentity, GlobalAttachmentLink, TestError } from "@allurereport/core-api";
import { DEFAULT_ENVIRONMENT, getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginExpressionFields,
  type PluginConstructorContext,
  type PluginContext,
  createPluginSummary,
} from "@allurereport/plugin-api";
import {
  TestOpsClient,
  TestOpsUploader,
  type TestOpsUploadTestResult,
  uploadFilenameForLink,
  validateExecutableName,
} from "@allurereport/service/testops";
import { groupBy, isEqual, stubTrue } from "lodash-es";
import { bold } from "yoctocolors";

import { LaunchGitFlow, resolveGitFlowOptions } from "./gitFlow/index.js";
import { Logger } from "./logger.js";
import type { TestOpsPluginOptions } from "./model.js";
import { applyCiOverrides } from "./utils/ciOverrides.js";
import { enrichWithCategories, syncLaunchCategories } from "./utils/launchCategories.js";
import { resolvePluginOptions, toPositiveInteger } from "./utils/options.js";
import { attachmentsResolverFactory, fixturesResolverFactory } from "./utils/resolvers.js";
import { toSessionVariables } from "./utils/sessionEnvironment.js";

const resolveJobRunIdFromEnv = (): number | undefined => toPositiveInteger(env.ALLURE_JOB_RUN_ID);

export class TestOpsPlugin implements Plugin {
  static readonly configExpressions = {
    filter: "testFilter",
    launchName: "name",
  } as const satisfies PluginExpressionFields;

  #logger = new Logger("TestOpsPlugin");
  #ci: CiDescriptor;
  #client!: TestOpsClient;
  #uploader!: TestOpsUploader;
  #launchName: string = "";
  #launchTags: string[] = [];
  #autocloseLaunch: boolean = false;
  #launchStarted: boolean = false;
  #launchId?: number;
  #gitFlow!: LaunchGitFlow;
  #enabledByConfig: boolean = false;

  constructor(
    readonly options: TestOpsPluginOptions,
    context: PluginConstructorContext = {},
  ) {
    applyAllureCiEnv();
    this.#ci = applyCiOverrides(detect());
    this.#enabledByConfig = context.enabled === true;

    if (context.enabled === false) {
      return;
    }

    if (isLocalCiDescriptor(this.#ci) && !this.isManuallyEnabled) {
      this.#logger.info(
        `plugin is disabled - no CI environment detected. To enable, set ${bold("ALLURE_TESTOPS_ENABLED")}=true or ${bold("CI")}=true.`,
      );
      return;
    }

    const {
      accessToken,
      endpoint,
      projectId,
      launchName,
      launchTags,
      autocloseLaunch = true,
      uploadRateLimit,
      reopenClosedLaunch = false,
      launchId,
    } = resolvePluginOptions(options);

    // don't initialize the client when some options are missing
    // we can' throw an error here because it would break the report execution flow
    if ([accessToken, endpoint, projectId].every(Boolean)) {
      this.#client = new TestOpsClient({
        baseUrl: endpoint,
        accessToken,
        projectId,
        uploadRateLimit,
      });
      this.#uploader = new TestOpsUploader(this.#client, this.#logger, reopenClosedLaunch);
      this.#launchName = launchName;
      this.#launchTags = launchTags;
    }

    this.#autocloseLaunch = autocloseLaunch;
    this.#launchId = launchId;
    const gitFlowOptions = resolveGitFlowOptions(options);

    this.#gitFlow = new LaunchGitFlow({
      ci: this.#ci,
      gitFlow: gitFlowOptions.gitFlow,
      ancestorLimit: gitFlowOptions.ancestorLimit,
      logger: this.#logger,
    });

    if (!accessToken) {
      this.#logger.warn(
        `Allure TestOps ${bold("access token")} is missing. Please provide a valid access token in the plugin options.`,
      );
    }

    if (!endpoint) {
      this.#logger.warn(
        `Allure TestOps ${bold("endpoint")} is missing. Please provide a valid endpoint in the plugin options.`,
      );
    }

    if (!projectId) {
      this.#logger.warn(
        `Allure TestOps ${bold("project ID")} is missing. Please provide a valid project ID in the plugin options.`,
      );
    }
  }

  get isOverridenByEnv(): boolean {
    const isEnabled = (value: string | undefined) => {
      if (!value) {
        return false;
      }

      return ["true", "1"].includes(value);
    };

    return isEnabled(env.ALLURE_TESTOPS_ENABLED) || isEnabled(env.CI) || resolveJobRunIdFromEnv() !== undefined;
  }

  get isManuallyEnabled(): boolean {
    return this.#enabledByConfig || this.isOverridenByEnv;
  }

  get enabled(): boolean {
    if (!(this.#client instanceof TestOpsClient)) {
      return false;
    }

    if (this.isManuallyEnabled) {
      return true;
    }

    if (!this.#ci || this.#ci.type === "local") {
      return false;
    }

    return true;
  }

  async #upload(
    store: AllureStore,
    options = {} as {
      context?: PluginContext;
      stage: "start" | "update" | "done";
    },
  ) {
    const { context, stage } = options;
    const trsToUpload = await this.#trsToUpload(store);
    const shouldUploadGlobalArtifacts = stage === "done" || !context?.realTime;
    let globalErrors: TestError[] = [];
    let globalAttachments: GlobalAttachmentLink[] = [];

    if (shouldUploadGlobalArtifacts) {
      const [allGlobalErrors, allGlobalAttachments] = await Promise.all([
        store.allGlobalErrors(),
        store.allGlobalAttachments(),
      ]);
      globalErrors = this.#uploader.pendingGlobalErrors(allGlobalErrors);
      globalAttachments = this.#uploader.pendingGlobalAttachments(allGlobalAttachments);
    }

    if (trsToUpload.length === 0) {
      if (stage == "update") {
        this.#logger.verbose("No new test results to upload");
      }

      if (stage === "done") {
        this.#logger.verbose("No test results to upload");
      }

      if (globalErrors.length === 0 && globalAttachments.length === 0) {
        return;
      }
    }

    if (stage === "update" && trsToUpload.length > 0) {
      this.#logger.verbose(
        `Found ${bold(trsToUpload.length.toString())} new test ${trsToUpload.length > 1 ? "results" : "result"}, uploading…`,
      );
    }

    const environments = await store.allEnvironmentIdentities();
    const contextCategories = context?.categories ?? [];
    const trsEnrichedWithCategories = await enrichWithCategories(store, trsToUpload, contextCategories, (environment) =>
      this.#environmentIdOf(environment, environments),
    );
    const groups = await this.#groupByEnvironmentVariables(store, trsEnrichedWithCategories);
    // results of environments with own variables go into their own sessions, so the base session may be unused
    const needsBaseSession = globalErrors.length > 0 || globalAttachments.length > 0 || groups.base.length > 0;
    const baseSession = await this.#uploader.prepareUploadSession(
      { ...env, ...groups.reportVariables },
      needsBaseSession,
    );

    if (!baseSession.ready) {
      return;
    }

    await this.#uploader.uploadGlobalAttachments(globalAttachments, async (attachmentLink) => {
      const content = await store.attachmentContentById(attachmentLink.id);
      const body = await content?.readContent(async (stream) => stream);
      const filename = uploadFilenameForLink(attachmentLink);

      if (filename === undefined || body === undefined) {
        return undefined;
      }

      return {
        originalFileName: filename,
        contentType: attachmentLink.contentType ?? "application/octet-stream",
        content: body,
        contentLength: content?.getContentLength(),
      };
    });
    await this.#uploader.uploadGlobalErrors(globalErrors);

    if (trsToUpload.length === 0) {
      return;
    }

    const categoriesError = await syncLaunchCategories(this.#client, trsEnrichedWithCategories, contextCategories);

    if (categoriesError) {
      this.#logger.warn(`Uploading test results without launch categories: ${categoriesError.message}`);
    }

    const uploadOptions = {
      attachmentsResolver: attachmentsResolverFactory(store),
      fixturesResolver: fixturesResolverFactory(store),
      silent: !!context?.realTime,
    };

    if (groups.base.length > 0) {
      await this.#uploader.uploadTestResults(groups.base, environments, {
        ...uploadOptions,
        queueName: "test-results",
        session: async () => baseSession.session!,
      });
    }

    for (const { environmentId, environmentVariables, trs } of groups.withOwnVariables) {
      await this.#uploader.uploadTestResults(trs, environments, {
        ...uploadOptions,
        queueName: `test-results:${environmentId}`,
        session: () => this.#uploader.environmentSession(environmentId, { ...env, ...environmentVariables }),
        environmentName: environments.find(({ id }) => id === environmentId)?.name ?? environmentId,
      });
    }

    // named environments are created while uploading test results, and quality gate items reference them
    await this.#uploader.uploadQualityGateResults(await store.qualityGateResults());
  }

  /**
   * Splits test results into the ones that go into the base session and per-environment groups
   * for environments whose variables differ from the report-level ones.
   */
  async #groupByEnvironmentVariables(store: AllureStore, trs: TestOpsUploadTestResult[]) {
    const configReportVariables = await store.allVariables();
    const reportVariables = toSessionVariables(configReportVariables);
    const base: TestOpsUploadTestResult[] = [];
    const withOwnVariables: {
      environmentId: string;
      environmentVariables: Record<string, string>;
      trs: TestOpsUploadTestResult[];
    }[] = [];
    const trsByEnvironment = groupBy(trs, (tr) => tr.environment ?? DEFAULT_ENVIRONMENT);

    for (const [environmentId, environmentTrs] of Object.entries(trsByEnvironment)) {
      const environmentVariables = await this.#environmentVariables(
        store,
        environmentId,
        configReportVariables,
        reportVariables,
      );

      if (isEqual(environmentVariables, reportVariables)) {
        // a loop, not push(...): spreading a large group into arguments overflows the call stack
        for (const tr of environmentTrs) {
          base.push(tr);
        }
      } else {
        withOwnVariables.push({ environmentId, environmentVariables, trs: environmentTrs });
      }
    }

    return { reportVariables, base, withOwnVariables };
  }

  /**
   * Results restored from dumps of older Allure versions keep the environment name instead of its id.
   */
  #environmentIdOf(environment: string | undefined, environments: EnvironmentIdentity[]) {
    if (environment === undefined || environments.some(({ id }) => id === environment)) {
      return environment;
    }

    return environments.find(({ name }) => name === environment)?.id ?? environment;
  }

  /**
   * Report variables overridden by the environment's own ones. An environment variable without a value doesn't
   * override anything, so the report value stays.
   */
  async #environmentVariables(
    store: AllureStore,
    environmentId: string,
    configReportVariables: Record<string, unknown>,
    reportVariables: Record<string, string>,
  ) {
    try {
      const merged: Record<string, unknown> = await store.envVariablesByEnvironmentId(environmentId);
      const own = Object.fromEntries(
        Object.entries(merged).filter(
          ([key, value]) => !Object.hasOwn(configReportVariables, key) || configReportVariables[key] !== value,
        ),
      );

      return { ...reportVariables, ...toSessionVariables(own) };
    } catch (error) {
      // the store rejects environment ids it can't validate; such results are uploaded with the report variables
      this.#logger.warn(`Failed to resolve variables of environment ${environmentId}: ${error}`);
      return reportVariables;
    }
  }

  async #trsToUpload(store: AllureStore) {
    const filter = this.options.filter ?? stubTrue;
    const filteredTrs = await store.allTestResults({
      filter: (tr) => {
        const uploaded = this.#uploader.hasUploadedTestResult(tr.id);

        if (uploaded) {
          return false;
        }

        return validateExecutableName(tr.name) && filter(tr);
      },
      includeRetries: false,
    });

    return filteredTrs;
  }

  async start(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    // an explicit --verbose/--quiet (global log level) must not be overridden by real-time mode
    if (context.realTime && getGlobalLogLevel() === undefined) {
      this.#logger.setLogLevel("info");
    }

    this.#logger.verbose("Starting upload…");

    const started = await this.#uploader.startUpload(this.#ci, {
      jobRunId: resolveJobRunIdFromEnv(),
      launchId: this.#launchId,
      launchName: this.#launchName,
      launchTags: this.#launchTags,
      gitContext: () => this.#gitFlow.resolve(),
    });

    this.#launchStarted ||= started;

    if (!this.#launchStarted) {
      return;
    }

    await this.#upload(store, { context, stage: "start" });

    this.#logger.info(`Allure TestOps Launch: ${this.#client.launchUrl}`);
  }

  async update(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    if (!this.#launchStarted) {
      this.#logger.verbose("Skipping update: the TestOps launch was never started");
      return;
    }

    this.#logger.verbose("Updating (uploading new results)…");

    await this.#upload(store, { context, stage: "update" });
  }

  async done(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    if (!this.#launchStarted) {
      this.#logger.verbose("Skipping finalization: the TestOps launch was never started");
      return;
    }

    const allTrs = await store.allTestResults({
      filter: this.options.filter,
      includeRetries: false,
    });

    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));

    this.#logger.verbose("Finalizing upload…");

    await this.#upload(store, { context, stage: "done" });

    await this.#uploader.finishUpload(this.#ci, worstStatus || "unknown", this.#autocloseLaunch);
  }

  async info(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return undefined;
    }

    if (!this.#client.launchUrl) {
      return undefined;
    }

    const summary = await createPluginSummary({
      name: this.#launchName,
      plugin: "TestOps",
      meta: {
        reportId: context.reportUuid,
      },
      filter: this.options.filter,
      history: context.history,
      ci: context.ci,
      store,
    });

    summary.remoteHref = this.#client.launchUrl;

    return summary;
  }
}
