import { extname } from "node:path";

/* eslint max-lines: off */
import {
  type AllureCheckResult,
  type AllureHistory,
  type AttachmentLink,
  type AttachmentLinkLinked,
  type DefaultLabelsConfig,
  DEFAULT_ENVIRONMENT,
  DEFAULT_ENVIRONMENT_IDENTITY,
  type EnvironmentIdentity,
  type EnvironmentDescriptor,
  type EnvironmentsConfig,
  type HistoryDataPoint,
  type HistoryTestResult,
  type KnownTestFailure,
  type ReportVariables,
  type Statistic,
  type TestCase,
  type TestEnvGroup,
  type TestError,
  type TestFixtureResult,
  type TestResult,
  type TestStepResult,
  compareBy,
  createDictionary,
  getHistoryIdCandidates,
  getWorstStatus,
  normalizeHistoryDataPoint,
  ordinal,
  reverse,
  selectHistoryTestResults,
  validateEnvironmentId,
  validateEnvironmentName,
} from "@allurereport/core-api";
import {
  type AllureStore,
  type AllureStoreDump,
  type ExitCode,
  type PluginGlobalAttachment,
  type PluginGlobalError,
  type QualityGateValidationResult,
  type RealtimeEventsDispatcher,
  type RealtimeSubscriber,
  type ResultFile,
  type TestResultFilter,
  md5,
} from "@allurereport/plugin-api";
import type {
  RawFixtureResult,
  RawGlobals,
  RawMetadata,
  RawTestResult,
  ReaderContext,
  ResultsVisitor,
} from "@allurereport/reader-api";

import {
  environmentIdentityById,
  normalizeEnvironmentDescriptorMap,
  resolveEnvironmentIdentity,
  resolveStoredEnvironmentIdentity,
  validateAllowedEnvironmentId,
} from "../utils/environment.js";
import { isFlaky } from "../utils/flaky.js";
import { getStatusTransition } from "../utils/new.js";
import { testFixtureResultRawToState, testResultRawToState } from "./convert.js";
import { calculateParametersHash, calculateRetryHash, RetrySubstore } from "./retrySubstore.js";

const index = <T>(indexMap: Map<string, T[]>, key: string | undefined, ...items: T[]) => {
  if (key) {
    if (!indexMap.has(key)) {
      indexMap.set(key, []);
    }

    const current = indexMap.get(key)!;

    current.push(...items);
  }
};

export const mapToObject = <K extends string | number | symbol, T = any>(map: Map<K, T>): Record<K, T> => {
  const result: Record<string | number | symbol, T> = {};

  map.forEach((value, key) => {
    result[key] = value;
  });

  return result;
};

export const updateMapWithRecord = <K extends string | number | symbol, T = any>(
  map: Map<K, T>,
  record: Record<K, T>,
): Map<K, T> => {
  Object.entries(record).forEach(([key, value]) => {
    map.set(key as K, value as T);
  });

  return map;
};

const relinkAttachmentSteps = (steps: TestStepResult[] = [], attachments: Map<string, AttachmentLink>) => {
  steps.forEach((step) => {
    if (step.type === "attachment") {
      const restoredLink = attachments.get(step.link.id);

      if (restoredLink && restoredLink.used) {
        step.link = restoredLink;
      }
      return;
    }

    relinkAttachmentSteps(step.steps, attachments);
  });
};

export class DefaultAllureStore implements AllureStore, ResultsVisitor {
  readonly #testResults: Map<string, TestResult>;
  // Restored/runtime aliases that should still resolve by display name.
  readonly #environmentDisplayNames: Map<string, string>;
  // Canonical display names from the current environment catalog.
  readonly #environmentNameToId: Map<string, string>;
  readonly #attachments: Map<string, AttachmentLink>;
  readonly #attachmentContents: Map<string, ResultFile>;
  readonly #testCases: Map<string, TestCase>;
  readonly #metadata: Map<string, any>;
  readonly #history: AllureHistory | undefined;
  readonly #known: KnownTestFailure[];
  readonly #fixtures: Map<string, TestFixtureResult>;
  readonly #defaultLabels: DefaultLabelsConfig = {};
  readonly #environment: EnvironmentIdentity | undefined;
  readonly #environmentsConfig: EnvironmentsConfig = {};
  readonly #reportVariables: ReportVariables = {};
  readonly #realtimeDispatcher?: RealtimeEventsDispatcher;
  readonly #realtimeSubscriber?: RealtimeSubscriber;
  readonly #allowedEnvironmentIds: Set<string>;
  readonly #retrySubstore: RetrySubstore;
  readonly #testResultIdsByEnvironmentId: Map<string, Set<string>> = new Map();
  readonly #cachedEnvironmentEntries: [string, EnvironmentDescriptor][] = [];

  readonly indexTestResultByTestCase: Map<string, TestResult[]> = new Map<string, TestResult[]>();
  readonly indexTestResultByEnvironmentId: Map<string, TestResult[]> = new Map<string, TestResult[]>();
  readonly indexTestResultByHistoryId: Map<string, TestResult[]> = new Map<string, TestResult[]>();
  readonly indexAttachmentByTestResult: Map<string, AttachmentLink[]> = new Map<string, AttachmentLink[]>();
  readonly indexAttachmentByFixture: Map<string, AttachmentLink[]> = new Map<string, AttachmentLink[]>();
  readonly indexFixturesByTestResult: Map<string, TestFixtureResult[]> = new Map<string, TestFixtureResult[]>();
  readonly indexKnownByHistoryId: Map<string, KnownTestFailure[]> = new Map<string, KnownTestFailure[]>();

  #globalAttachmentIds: string[] = [];
  #globalAttachmentIdsByEnv: Map<string, string[]> = new Map();
  #globalErrors: PluginGlobalError[] = [];
  #globalErrorsByEnv: Map<string, PluginGlobalError[]> = new Map();
  #globalExitCode: ExitCode | undefined;
  #checkResultsById: Map<string, AllureCheckResult> = new Map();
  #qualityGateResults: QualityGateValidationResult[] = [];
  #historyPoints: HistoryDataPoint[] = [];
  #environments: EnvironmentIdentity[] = [];

  constructor(params?: {
    history?: AllureHistory;
    known?: KnownTestFailure[];
    realtimeDispatcher?: RealtimeEventsDispatcher;
    realtimeSubscriber?: RealtimeSubscriber;
    defaultLabels?: DefaultLabelsConfig;
    environment?: string;
    allowedEnvironments?: string[];
    environmentsConfig?: EnvironmentsConfig;
    reportVariables?: ReportVariables;
  }) {
    const {
      history,
      known = [],
      realtimeDispatcher,
      realtimeSubscriber,
      defaultLabels = {},
      environment,
      allowedEnvironments,
      environmentsConfig = {},
      reportVariables = {},
    } = params ?? {};
    const errors: string[] = [];
    const {
      normalized: normalizedEnvironmentsConfig,
      identities,
      errors: configErrors,
    } = normalizeEnvironmentDescriptorMap(environmentsConfig, "environmentsConfig");
    errors.push(...configErrors);
    const forcedEnvironment = resolveEnvironmentIdentity(
      {
        environment,
      },
      normalizedEnvironmentsConfig,
      "store constructor",
    );
    errors.push(...forcedEnvironment.errors);
    const resolvedEnvironment = forcedEnvironment.identity;

    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }

    const environments = [...identities];

    if (resolvedEnvironment) {
      environments.push(resolvedEnvironment);
    }

    this.#testResults = new Map<string, TestResult>();
    this.#environmentDisplayNames = new Map<string, string>();
    this.#environmentNameToId = new Map<string, string>();
    this.#attachments = new Map<string, AttachmentLink>();
    this.#attachmentContents = new Map<string, ResultFile>();
    this.#testCases = new Map<string, TestCase>();
    this.#metadata = new Map<string, any>();
    this.#fixtures = new Map<string, TestFixtureResult>();
    this.#history = history;
    this.#known = [...known];
    this.#known.forEach((ktf) => index(this.indexKnownByHistoryId, ktf.historyId, ktf));
    this.#realtimeDispatcher = realtimeDispatcher;
    this.#realtimeSubscriber = realtimeSubscriber;
    this.#defaultLabels = defaultLabels;
    this.#environmentsConfig = normalizedEnvironmentsConfig;
    this.#environment = resolvedEnvironment;
    this.#reportVariables = reportVariables;
    this.#allowedEnvironmentIds = new Set(allowedEnvironments ?? []);
    this.#retrySubstore = new RetrySubstore();
    this.#cachedEnvironmentEntries = Object.entries(this.#environmentsConfig);

    this.#addEnvironments(environments);

    this.#realtimeSubscriber?.onQualityGateResults((results: QualityGateValidationResult[]) => {
      this.#qualityGateResults.push(...results);
      this.#addEnvironments(
        results
          .map((result) => {
            const aliasedEnvironmentId =
              typeof result.environment === "string" ? this.#environmentIdByName(result.environment) : undefined;

            if (aliasedEnvironmentId) {
              const aliasedEnvironment =
                this.#environments.find(({ id }) => id === aliasedEnvironmentId)?.name ?? aliasedEnvironmentId;

              return {
                id: aliasedEnvironmentId,
                name: aliasedEnvironment,
              };
            }

            return resolveStoredEnvironmentIdentity(
              {
                environmentName: result.environment,
                labels: [],
              },
              this.#environmentsConfig,
              {
                forcedEnvironment: this.#environment,
              },
            );
          })
          .filter(Boolean) as EnvironmentIdentity[],
      );
    });
    this.#realtimeSubscriber?.onGlobalExitCode((exitCode: ExitCode) => {
      this.#globalExitCode = exitCode;
    });
    this.#realtimeSubscriber?.onGlobalError((error: PluginGlobalError) => {
      this.#addGlobalError(error);
    });
    this.#realtimeSubscriber?.onGlobalAttachment(({ attachment, fileName, environment }) => {
      const originalFileName = attachment.getOriginalFileName();
      const resolvedEnvironment = this.#resolveGlobalEnvironmentIdentity(environment);
      const attachmentLink: PluginGlobalAttachment = {
        id: this.#globalAttachmentId(originalFileName, resolvedEnvironment?.id),
        name: fileName || originalFileName,
        missed: false,
        used: true,
        ext: attachment.getExtension(),
        contentType: attachment.getContentType(),
        contentLength: attachment.getContentLength(),
        originalFileName,
        environment: resolvedEnvironment?.name ?? environment,
      };

      this.#addGlobalAttachment(attachmentLink, attachment);
    });
  }

  #mergeEnvironmentIdentity(
    existingEnvironment: EnvironmentIdentity | undefined,
    incomingEnvironment: EnvironmentIdentity,
  ): EnvironmentIdentity {
    const configuredEnvironment = environmentIdentityById(this.#environmentsConfig, incomingEnvironment.id);

    if (configuredEnvironment) {
      return configuredEnvironment;
    }

    if (existingEnvironment) {
      const existingNameValidation = validateEnvironmentName(existingEnvironment.name);

      if (existingNameValidation.valid) {
        return {
          id: existingEnvironment.id,
          name: existingNameValidation.normalized,
        };
      }
    }

    const incomingNameValidation = validateEnvironmentName(incomingEnvironment.name);

    if (incomingNameValidation.valid) {
      return {
        id: incomingEnvironment.id,
        name: incomingNameValidation.normalized,
      };
    }

    return {
      id: incomingEnvironment.id,
      name: incomingEnvironment.id,
    };
  }

  #environmentIdForLookup(environmentKey: string) {
    const aliasedEnvironmentId = this.#environmentIdByName(environmentKey);

    if (aliasedEnvironmentId) {
      return aliasedEnvironmentId;
    }

    const environmentIdValidation = validateEnvironmentId(environmentKey);

    return environmentIdValidation.valid ? environmentIdValidation.normalized : undefined;
  }

  #addEnvironments(envs: EnvironmentIdentity[]) {
    if (this.#environments.length === 0) {
      this.#environments.push(DEFAULT_ENVIRONMENT_IDENTITY);
    }

    const nextById = new Map(this.#environments.map((environment) => [environment.id, environment]));

    envs.forEach((environment) => {
      nextById.set(environment.id, this.#mergeEnvironmentIdentity(nextById.get(environment.id), environment));
    });

    this.#environments = Array.from(nextById.values());

    this.#environmentNameToId.clear();
    this.#environments.forEach(({ id, name }) => {
      this.#environmentNameToId.set(name, id);
    });
    envs.forEach(({ id, name }) => {
      this.#environmentDisplayNames.set(name, id);
    });
  }

  #environmentIdByName(environmentName: string): string | undefined {
    const canonicalId = this.#environmentNameToId.get(environmentName);
    if (canonicalId) {
      return canonicalId;
    }

    return this.#environmentDisplayNames.get(environmentName);
  }

  #setTestResultEnvironmentId(testResult: TestResult, environmentId: string | undefined) {
    if (!environmentId) {
      return;
    }

    const ids = this.#testResultIdsByEnvironmentId.get(environmentId);
    if (ids?.has(testResult.id)) {
      return;
    }

    if (!ids) {
      this.#testResultIdsByEnvironmentId.set(environmentId, new Set([testResult.id]));
    } else {
      ids.add(testResult.id);
    }

    index(this.indexTestResultByEnvironmentId, environmentId, testResult);
  }

  #assertAllowedEnvironmentId(environmentId: string | undefined, sourcePath: string) {
    if (!environmentId) {
      return;
    }

    const error = validateAllowedEnvironmentId(environmentId, this.#allowedEnvironmentIds, sourcePath);

    if (error) {
      throw new Error(error);
    }
  }

  #assertAllowedStoredEnvironment(
    params: {
      environment?: unknown;
      environmentName?: unknown;
      labels?: TestResult["labels"];
    },
    sourcePath: string,
    options?: {
      fallbackToMatch?: boolean;
    },
  ) {
    const identity = resolveStoredEnvironmentIdentity(params, this.#environmentsConfig, {
      forcedEnvironment: this.#environment,
      fallbackToMatch: options?.fallbackToMatch,
    });
    const environmentKey =
      identity?.id ??
      (typeof params.environment === "string" ? params.environment : undefined) ??
      (typeof params.environmentName === "string" ? params.environmentName : undefined);

    if (environmentKey === undefined) {
      return;
    }

    this.#assertAllowedEnvironmentId(environmentKey, sourcePath);
  }

  #environmentIdByTestResult(testResult: TestResult) {
    const storedEnvironmentKey = typeof testResult.environment === "string" ? testResult.environment : undefined;
    return (
      (storedEnvironmentKey ? this.#environmentIdByName(storedEnvironmentKey) : undefined) ??
      resolveStoredEnvironmentIdentity(
        {
          environment: testResult.environment,
          labels: testResult.labels,
        },
        this.#environmentsConfig,
        {
          forcedEnvironment: this.#environment,
        },
      )?.id
    );
  }

  #assignRetryHash(testResult: TestResult, options?: { parametersHash?: string; environmentId?: string }) {
    const environmentId = options?.environmentId ?? this.#environmentIdByTestResult(testResult);
    const parametersHash = options?.parametersHash ?? calculateParametersHash(testResult.parameters);
    testResult.retryHash = calculateRetryHash(testResult.testCase?.id, parametersHash, environmentId);
  }

  #rebuildRetrySubstore() {
    this.#retrySubstore.reset();

    for (const [, testResult] of this.#testResults) {
      if (!testResult.retryHash) {
        this.#assignRetryHash(testResult);
      }

      this.#retrySubstore.upsert(testResult);
    }
  }

  #resolveGlobalEnvironmentIdentity(environment?: string): EnvironmentIdentity | undefined {
    if (environment !== undefined) {
      const resolvedEnvironment = resolveStoredEnvironmentIdentity(
        {
          environment,
          environmentName: environment,
        },
        this.#environmentsConfig,
        {
          fallbackToMatch: false,
        },
      );

      if (resolvedEnvironment) {
        return resolvedEnvironment;
      }
    }

    if (this.#environment) {
      return this.#environment;
    }

    return DEFAULT_ENVIRONMENT_IDENTITY;
  }

  #globalAttachmentId(originalFileName: string, environmentId?: string) {
    return md5(environmentId ? `${environmentId}:${originalFileName}` : originalFileName);
  }

  #indexGlobalError(error: PluginGlobalError) {
    const resolvedEnvironment = this.#resolveGlobalEnvironmentIdentity(error.environment);

    if (!resolvedEnvironment) {
      return error;
    }

    error.environment = resolvedEnvironment.name;
    this.#addEnvironments([resolvedEnvironment]);
    index(this.#globalErrorsByEnv, resolvedEnvironment.id, error);

    return error;
  }

  #addGlobalError(error: PluginGlobalError) {
    this.#globalErrors.push(this.#indexGlobalError(error));
  }

  #indexGlobalAttachment(attachmentLink: PluginGlobalAttachment) {
    const resolvedEnvironment = this.#resolveGlobalEnvironmentIdentity(attachmentLink.environment);

    if (!resolvedEnvironment) {
      return attachmentLink;
    }

    attachmentLink.environment = resolvedEnvironment.name;
    this.#addEnvironments([resolvedEnvironment]);
    index(this.#globalAttachmentIdsByEnv, resolvedEnvironment.id, attachmentLink.id);

    return attachmentLink;
  }

  #addGlobalAttachment(attachmentLink: PluginGlobalAttachment, attachment?: ResultFile) {
    const indexedAttachment = this.#indexGlobalAttachment({ ...attachmentLink });

    this.#attachments.set(indexedAttachment.id, indexedAttachment);

    if (attachment) {
      this.#attachmentContents.set(indexedAttachment.id, attachment);
    }

    this.#globalAttachmentIds.push(indexedAttachment.id);
  }

  // history state

  async readHistory(): Promise<HistoryDataPoint[]> {
    if (!this.#history) {
      return [];
    }

    this.#historyPoints = ((await this.#history.readHistory()) ?? [])
      .filter(
        (historyPoint): historyPoint is HistoryDataPoint => typeof historyPoint === "object" && historyPoint !== null,
      )
      .map(normalizeHistoryDataPoint);
    this.#historyPoints.sort(compareBy("timestamp", reverse(ordinal())));

    return this.#historyPoints;
  }

  async appendHistory(history: HistoryDataPoint): Promise<void> {
    if (!this.#history) {
      return;
    }

    this.#historyPoints.push(history);

    await this.#history.appendHistory(history);
  }

  // check data

  async addCheckResult(result: AllureCheckResult): Promise<void> {
    this.#checkResultsById.set(result.id, {
      ...result,
      ...(result.tags?.length ? { tags: [...result.tags] } : {}),
      details: {
        command: result.details.command,
        ...(result.details.message ? { message: result.details.message } : {}),
        ...(result.details.error ? { error: result.details.error } : {}),
      },
    });
  }

  async allCheckResults(): Promise<AllureCheckResult[]> {
    return Array.from(this.#checkResultsById.values()).map((result) => ({
      ...result,
      ...(result.tags ? { tags: [...result.tags] } : {}),
      details: {
        command: result.details.command,
        ...(result.details.message ? { message: result.details.message } : {}),
        ...(result.details.error ? { error: result.details.error } : {}),
      },
    }));
  }

  // quality gate data

  async qualityGateResults(): Promise<QualityGateValidationResult[]> {
    return [...this.#qualityGateResults];
  }

  async qualityGateResultsByEnv(): Promise<Record<string, QualityGateValidationResult[]>> {
    const resultsById = await this.qualityGateResultsByEnvironmentId();
    const resultsByEnv = createDictionary<QualityGateValidationResult[]>();

    Object.entries(resultsById).forEach(([environmentId, results]) => {
      const environmentName = this.#environments.find(({ id }) => id === environmentId)?.name ?? environmentId;

      resultsByEnv[environmentName] = results;
    });

    return resultsByEnv;
  }

  async qualityGateResultsByEnvironmentId(): Promise<Record<string, QualityGateValidationResult[]>> {
    const resultsById = createDictionary<QualityGateValidationResult[]>();

    for (const result of this.#qualityGateResults) {
      const aliasedEnvironmentId =
        typeof result.environment === "string" ? this.#environmentIdByName(result.environment) : undefined;
      const envIdentity =
        aliasedEnvironmentId !== undefined
          ? {
              id: aliasedEnvironmentId,
              name: this.#environments.find(({ id }) => id === aliasedEnvironmentId)?.name ?? aliasedEnvironmentId,
            }
          : resolveStoredEnvironmentIdentity(
              {
                environmentName: result.environment,
                labels: [],
              },
              this.#environmentsConfig,
              {
                forcedEnvironment: this.#environment,
              },
            );

      if (!envIdentity) {
        continue;
      }

      if (!resultsById[envIdentity.id]) {
        resultsById[envIdentity.id] = [];
      }

      resultsById[envIdentity.id].push(result);
    }

    return resultsById;
  }

  // global data

  async globalExitCode(): Promise<ExitCode | undefined> {
    return this.#globalExitCode;
  }

  async allGlobalErrors(): Promise<TestError[]> {
    return this.#globalErrors;
  }

  async allGlobalErrorsByEnv(): Promise<Record<string, PluginGlobalError[]>> {
    return mapToObject(this.#globalErrorsByEnv);
  }

  async allGlobalAttachments(): Promise<AttachmentLink[]> {
    return this.#globalAttachmentIds.reduce((acc, id) => {
      const attachment = this.#attachments.get(id);

      if (!attachment) {
        return acc;
      }

      acc.push(attachment);

      return acc;
    }, [] as AttachmentLink[]);
  }

  async allGlobalAttachmentsByEnv(): Promise<Record<string, PluginGlobalAttachment[]>> {
    const result: Record<string, PluginGlobalAttachment[]> = {};

    this.#globalAttachmentIdsByEnv.forEach((attachmentIds, environmentId) => {
      result[environmentId] = attachmentIds.reduce((acc, id) => {
        const attachment = this.#attachments.get(id);

        if (!attachment) {
          return acc;
        }

        acc.push(attachment as PluginGlobalAttachment);

        return acc;
      }, [] as PluginGlobalAttachment[]);
    });

    return result;
  }

  // test methods

  // visitor API

  async visitCheckResult(result: AllureCheckResult): Promise<void> {
    await this.addCheckResult(result);
  }

  /**
   * Process a raw test result into the store.
   *
   * Time complexity: O(k) where k is the number of labels and attachments.
   * Environment matching uses a cached entries array for O(m) lookup where m
   * is the number of configured environments (typically < 10).
   * History resolution is skipped entirely when no history is configured.
   */
  async visitTestResult(raw: RawTestResult, context: ReaderContext): Promise<void> {
    const attachmentLinks: AttachmentLink[] = [];
    const testResult = testResultRawToState(
      {
        testCases: this.#testCases,
        attachments: this.#attachments,
        visitAttachmentLink: (link) => attachmentLinks.push(link),
      },
      raw,
      context,
    );

    const defaultLabelsNames = Object.keys(this.#defaultLabels);

    if (defaultLabelsNames.length) {
      defaultLabelsNames.forEach((labelName) => {
        if (!testResult.labels.find((label) => label.name === labelName)) {
          const defaultLabelValue = this.#defaultLabels[labelName];

          ([] as string[]).concat(defaultLabelValue as string[]).forEach((labelValue) => {
            testResult.labels.push({
              name: labelName,
              value: labelValue,
            });
          });
        }
      });
    }

    const environmentIdentity =
      this.#environment ??
      (() => {
        const match = this.#cachedEnvironmentEntries.find(([, { matcher }]) => matcher({ labels: testResult.labels }));

        if (!match) {
          return DEFAULT_ENVIRONMENT_IDENTITY;
        }

        const [id, descriptor] = match;

        return { id, name: descriptor.name ?? id };
      })();

    testResult.environment = environmentIdentity.name;
    this.#addEnvironments([environmentIdentity]);
    const parametersHash =
      typeof raw.parametersHash === "string" && raw.parametersHash.length > 0
        ? raw.parametersHash
        : calculateParametersHash(testResult.parameters);
    testResult.retryHash = calculateRetryHash(testResult.testCase?.id, parametersHash, environmentIdentity.id);

    const trHistory = this.#history ? await this.historyByTr(testResult) : undefined;

    if (trHistory !== undefined) {
      testResult.transition = getStatusTransition(testResult, trHistory);
      testResult.flaky = isFlaky(testResult, trHistory);
    }

    this.#testResults.set(testResult.id, testResult);
    this.#setTestResultEnvironmentId(testResult, environmentIdentity.id);
    this.#retrySubstore.recordIngestOrder(testResult.id);
    this.#retrySubstore.upsert(testResult);

    index(this.indexTestResultByTestCase, testResult.testCase?.id, testResult);
    index(this.indexTestResultByHistoryId, testResult.historyId, testResult);
    index(this.indexAttachmentByTestResult, testResult.id, ...attachmentLinks);

    this.#realtimeDispatcher?.sendTestResult(testResult.id);
  }

  async visitTestFixtureResult(result: RawFixtureResult, context: ReaderContext): Promise<void> {
    const attachmentLinks: AttachmentLink[] = [];
    const testFixtureResult = testFixtureResultRawToState(
      {
        attachments: this.#attachments,
        visitAttachmentLink: (link) => attachmentLinks.push(link),
      },
      result,
      context,
    );

    this.#fixtures.set(testFixtureResult.id, testFixtureResult);

    testFixtureResult.testResultIds.forEach((trId) => {
      index(this.indexFixturesByTestResult, trId, testFixtureResult);
    });
    index(this.indexAttachmentByFixture, testFixtureResult.id, ...attachmentLinks);
    this.#realtimeDispatcher?.sendTestFixtureResult(testFixtureResult.id);
  }

  async visitAttachmentFile(resultFile: ResultFile): Promise<void> {
    const originalFileName = resultFile.getOriginalFileName();
    const id = md5(originalFileName);

    this.#attachmentContents.set(id, resultFile);

    const maybeLink = this.#attachments.get(id);

    if (maybeLink) {
      const link = maybeLink as AttachmentLinkLinked;

      link.missed = false;
      link.ext = link.ext === undefined || link.ext === "" ? resultFile.getExtension() : link.ext;
      link.contentType = link.contentType ?? resultFile.getContentType();
      link.contentLength = resultFile.getContentLength();
    } else {
      this.#attachments.set(id, {
        used: false,
        missed: false,
        id,
        originalFileName,
        ext: resultFile.getExtension(),
        contentType: resultFile.getContentType(),
        contentLength: resultFile.getContentLength(),
      });
    }

    for (const globalAttachmentId of this.#globalAttachmentIds) {
      const globalAttachment = this.#attachments.get(globalAttachmentId);

      if (!globalAttachment || globalAttachment.originalFileName !== originalFileName) {
        continue;
      }

      const linkedGlobalAttachment = globalAttachment as AttachmentLinkLinked;

      linkedGlobalAttachment.missed = false;
      linkedGlobalAttachment.ext =
        linkedGlobalAttachment.ext === undefined || linkedGlobalAttachment.ext === ""
          ? resultFile.getExtension()
          : linkedGlobalAttachment.ext;
      linkedGlobalAttachment.contentType = linkedGlobalAttachment.contentType ?? resultFile.getContentType();
      linkedGlobalAttachment.contentLength = resultFile.getContentLength();
      this.#attachmentContents.set(globalAttachmentId, resultFile);
      this.#realtimeDispatcher?.sendAttachmentFile(globalAttachmentId);
    }

    this.#realtimeDispatcher?.sendAttachmentFile(id);
  }

  async visitMetadata(metadata: RawMetadata): Promise<void> {
    Object.keys(metadata).forEach((key) => {
      this.#metadata.set(key, metadata[key]);
    });
  }

  async visitGlobals(globals: RawGlobals): Promise<void> {
    const { errors, attachments } = globals;

    errors.forEach((error) => {
      this.#addGlobalError(error);
    });

    attachments.forEach((attachment) => {
      const originalFileName = attachment.originalFileName!;
      const resolvedEnvironment = this.#resolveGlobalEnvironmentIdentity(attachment.environment);
      const linkedAttachment = this.#attachments.get(md5(originalFileName)) as AttachmentLinkLinked | undefined;
      const attachmentContent = this.#attachmentContents.get(md5(originalFileName));
      const attachmentLink: PluginGlobalAttachment = {
        id: this.#globalAttachmentId(originalFileName, resolvedEnvironment?.id),
        name: attachment?.name || originalFileName,
        originalFileName,
        ext: extname(originalFileName),
        used: true,
        missed: !attachmentContent,
        contentType: attachment?.contentType ?? linkedAttachment?.contentType,
        contentLength: linkedAttachment?.contentLength,
        environment: resolvedEnvironment?.name ?? attachment.environment,
      };

      this.#addGlobalAttachment(attachmentLink, attachmentContent);
    });
  }

  // state access API

  async allTestCases(): Promise<TestCase[]> {
    return Array.from(this.#testCases.values());
  }

  async allTestResults(
    options: {
      includeRetries?: boolean;
      filter?: TestResultFilter;
    } = { includeRetries: false },
  ): Promise<TestResult[]> {
    const { includeRetries = false, filter } = options;
    const result: TestResult[] = [];

    for (const [, tr] of this.#testResults) {
      if (!includeRetries && tr.isRetry) {
        continue;
      }

      if (typeof filter === "function" && !filter(tr)) {
        continue;
      }

      result.push(tr);
    }

    return result;
  }

  async allAttachments(
    options: {
      includeMissed?: boolean;
      includeUnused?: boolean;
    } = {},
  ): Promise<AttachmentLink[]> {
    const { includeMissed = false, includeUnused = false } = options;
    const filteredAttachments: AttachmentLink[] = [];

    for (const [, attachment] of this.#attachments) {
      if (!includeMissed && attachment.missed) {
        continue;
      }

      if (!includeUnused && !attachment.used) {
        continue;
      }

      filteredAttachments.push(attachment);
    }

    return filteredAttachments;
  }

  async allMetadata(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    this.#metadata.forEach((value, key) => (result[key] = value));
    return result;
  }

  async allFixtures(): Promise<TestFixtureResult[]> {
    return Array.from(this.#fixtures.values());
  }

  async allHistoryDataPoints(): Promise<HistoryDataPoint[]> {
    return this.#historyPoints;
  }

  async allHistoryDataPointsByEnvironment(environment: string): Promise<HistoryDataPoint[]> {
    const environmentNameValidation = validateEnvironmentName(environment);

    if (!environmentNameValidation.valid) {
      return [];
    }

    const environmentId = this.#environmentIdByName(environmentNameValidation.normalized);

    if (!environmentId) {
      return [];
    }

    return this.allHistoryDataPointsByEnvironmentId(environmentId);
  }

  async allHistoryDataPointsByEnvironmentId(environmentId: string): Promise<HistoryDataPoint[]> {
    const normalizedEnvironmentId = this.#environmentIdForLookup(environmentId);

    if (!normalizedEnvironmentId) {
      const validation = validateEnvironmentId(environmentId);
      const reason = validation.valid ? "unknown environment id" : validation.reason;

      throw new Error(`Invalid environmentId ${JSON.stringify(environmentId)}: ${reason}`);
    }

    return this.#historyPoints.reduce((result, dp) => {
      const filteredTestResults: HistoryTestResult[] = [];

      for (const tr of Object.values(dp.testResults ?? {})) {
        const storedEnvironmentKey = typeof tr.environment === "string" ? tr.environment : undefined;
        const trEnvId =
          (storedEnvironmentKey ? this.#environmentIdByName(storedEnvironmentKey) : undefined) ??
          resolveStoredEnvironmentIdentity(
            {
              environment: tr.environment,
              labels: tr.labels ?? [],
            },
            this.#environmentsConfig,
            {
              forcedEnvironment: this.#environment,
            },
          )?.id;

        if (trEnvId === normalizedEnvironmentId) {
          filteredTestResults.push(tr);
        }
      }
      const hasNoEnvironmentTestResults = filteredTestResults.length === 0;

      result.push({
        ...dp,
        testResults: hasNoEnvironmentTestResults
          ? {}
          : filteredTestResults.reduce(
              (acc, tr) => {
                acc[tr.historyId!] = tr;
                return acc;
              },
              {} as Record<string, HistoryTestResult>,
            ),
        knownTestCaseIds: hasNoEnvironmentTestResults ? [] : filteredTestResults.map((tr) => tr.id),
      });

      return result;
    }, [] as HistoryDataPoint[]);
  }

  async allKnownIssues(): Promise<KnownTestFailure[]> {
    return this.#known;
  }

  async allNewTestResults(filter?: TestResultFilter, history?: HistoryDataPoint[]): Promise<TestResult[]> {
    // when history doesn't exist we can't treat tests as new
    if (!this.#history && !history) {
      return [];
    }

    const allHistoryDps = history ?? (await this.allHistoryDataPoints());

    // when history exists, but it's empty – all tests can be treated as new
    if (allHistoryDps.length === 0) {
      return Array.from(this.#testResults.values());
    }

    const historicalIds = new Set(allHistoryDps.flatMap((dp) => Object.keys(dp.testResults ?? {})));
    const newTrs: TestResult[] = [];

    for (const [, tr] of this.#testResults) {
      if (tr.isRetry) {
        continue;
      }

      if (typeof filter === "function" && !filter(tr)) {
        continue;
      }

      const historyIdCandidates = getHistoryIdCandidates(tr);

      if (historyIdCandidates.length === 0 || historyIdCandidates.every((historyId) => !historicalIds.has(historyId))) {
        newTrs.push(tr);
      }
    }

    return newTrs;
  }

  // search api

  async testCaseById(tcId: string): Promise<TestCase | undefined> {
    return this.#testCases.get(tcId);
  }

  async testResultById(trId: string): Promise<TestResult | undefined> {
    return this.#testResults.get(trId);
  }

  async attachmentById(attachmentId: string): Promise<AttachmentLink | undefined> {
    return this.#attachments.get(attachmentId);
  }

  async attachmentContentById(attachmentId: string): Promise<ResultFile | undefined> {
    return this.#attachmentContents.get(attachmentId);
  }

  markAttachmentMissed(attachmentId: string) {
    const attachment = this.#attachments.get(attachmentId);

    if (!attachment) {
      return;
    }

    const missedAttachment = attachment as AttachmentLink & { contentLength?: number; missed: boolean };

    missedAttachment.missed = true;
    delete missedAttachment.contentLength;
    this.#attachmentContents.delete(attachmentId);
    this.#relinkRestoredAttachmentSteps();
  }

  #restoreAttachmentContent(id: string, content: ResultFile) {
    const attachment = this.#attachments.get(id);

    this.#attachmentContents.set(id, content);

    if (!attachment) {
      return;
    }

    const linkedAttachment = attachment as AttachmentLinkLinked;

    linkedAttachment.missed = false;
    linkedAttachment.contentType = linkedAttachment.contentType ?? content.getContentType();
    linkedAttachment.contentLength = content.getContentLength();
    linkedAttachment.ext =
      linkedAttachment.ext === undefined || linkedAttachment.ext === "" ? content.getExtension() : linkedAttachment.ext;
  }

  #relinkRestoredAttachmentSteps() {
    this.#testResults.forEach(({ steps }) => {
      relinkAttachmentSteps(steps, this.#attachments);
    });
    this.#fixtures.forEach(({ steps }) => {
      relinkAttachmentSteps(steps, this.#attachments);
    });
  }

  async metadataByKey<T>(key: string): Promise<T | undefined> {
    return this.#metadata.get(key);
  }

  async testResultsByTcId(tcId: string): Promise<TestResult[]> {
    return this.indexTestResultByTestCase.get(tcId) ?? [];
  }

  async environmentIdByTrId(trId: string): Promise<string | undefined> {
    const testResult = this.#testResults.get(trId);

    return testResult ? this.#environmentIdByTestResult(testResult) : undefined;
  }

  async attachmentsByTrId(trId: string): Promise<AttachmentLink[]> {
    return this.indexAttachmentByTestResult.get(trId) ?? [];
  }

  #retriesByTr(tr?: TestResult): TestResult[] {
    if (!tr) {
      return [];
    }

    return this.#retrySubstore.retriesByTr(tr);
  }

  async retriesByTr(tr?: TestResult): Promise<TestResult[]> {
    return this.#retriesByTr(tr);
  }

  async retriesByTrId(trId: string): Promise<TestResult[]> {
    const tr = this.#testResults.get(trId);

    return this.#retriesByTr(tr);
  }

  #historyByTr(tr: TestResult): HistoryTestResult[] | undefined {
    if (!this.#history) {
      return undefined;
    }

    const historyIdCandidates = getHistoryIdCandidates(tr);

    if (historyIdCandidates.length === 0) {
      return [];
    }

    return selectHistoryTestResults(this.#historyPoints, historyIdCandidates);
  }

  /**
   * Get historical test results for a given test result.
   *
   * Returns `undefined` when no history source is configured.
   * Returns an empty array when history is configured but no matching
   * history ID candidates are found.
   *
   * This method is async for API compatibility, but the underlying
   * lookup is synchronous.
   */
  async historyByTr(tr: TestResult): Promise<HistoryTestResult[] | undefined> {
    return this.#historyByTr(tr);
  }

  async historyByTrId(trId: string): Promise<HistoryTestResult[] | undefined> {
    const tr = this.#testResults.get(trId);

    if (!tr) {
      return undefined;
    }

    return this.#historyByTr(tr);
  }

  async fixturesByTrId(trId: string): Promise<TestFixtureResult[]> {
    return this.indexFixturesByTestResult.get(trId) ?? [];
  }

  async relatedByTestResultIds(trIds: readonly string[]) {
    const attachmentsByTrId = new Map<string, AttachmentLink[]>();
    const fixturesByTrId = new Map<string, TestFixtureResult[]>();
    const historyByTrId = new Map<string, HistoryTestResult[] | undefined>();
    const retriesByTrId = new Map<string, TestResult[]>();

    for (const trId of trIds) {
      const tr = this.#testResults.get(trId);

      attachmentsByTrId.set(trId, this.indexAttachmentByTestResult.get(trId) ?? []);
      fixturesByTrId.set(trId, this.indexFixturesByTestResult.get(trId) ?? []);
      retriesByTrId.set(trId, this.#retriesByTr(tr));
      historyByTrId.set(trId, tr ? this.#historyByTr(tr) : undefined);
    }

    return {
      attachmentsByTrId,
      fixturesByTrId,
      historyByTrId,
      retriesByTrId,
    };
  }

  // aggregate API

  async failedTestResults() {
    const failedTrs: TestResult[] = [];

    for (const [, tr] of this.#testResults) {
      if (tr.isRetry) {
        continue;
      }

      if (tr.status === "failed" || tr.status === "broken") {
        failedTrs.push(tr);
      }
    }

    return failedTrs;
  }

  async unknownFailedTestResults() {
    const failedTestResults = await this.failedTestResults();

    if (!this.#known?.length) {
      return failedTestResults;
    }

    const knownHistoryIds = new Set(this.#known.map((ktf) => ktf.historyId));

    return failedTestResults.filter((tr) => {
      const historyIdCandidates = getHistoryIdCandidates(tr);

      return (
        historyIdCandidates.length > 0 && historyIdCandidates.every((historyId) => !knownHistoryIds.has(historyId))
      );
    });
  }

  async testResultsByLabel(labelName: string): Promise<{ _: TestResult[]; [x: string]: TestResult[] }> {
    const results = createDictionary<TestResult[]>() as { _: TestResult[]; [x: string]: TestResult[] };
    results._ = [];

    for (const [, test] of this.#testResults) {
      if (test.isRetry) {
        continue;
      }

      const targetLabels = (test.labels ?? []).filter((label) => label.name === labelName);

      if (targetLabels.length === 0) {
        results._.push(test);
        continue;
      }

      targetLabels.forEach((label) => {
        if (!results[label.value!]) {
          results[label.value!] = [];
        }

        results[label.value!].push(test);
      });
    }

    return results;
  }

  async testsStatistic(filter?: TestResultFilter) {
    const statistic: Statistic = { total: 0 };

    for (const [, tr] of this.#testResults) {
      if (tr.isRetry) {
        continue;
      }

      if (filter && !filter(tr)) {
        continue;
      }

      statistic.total++;

      const retries = this.#retriesByTr(tr);

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

    return statistic;
  }

  // environments

  async allEnvironments() {
    return this.#environments.map(({ name }) => name);
  }

  async allEnvironmentIdentities() {
    return this.#environments;
  }

  async testResultsByEnvironment(
    env: string,
    options: {
      includeRetries?: boolean;
    } = { includeRetries: false },
  ) {
    const environmentNameValidation = validateEnvironmentName(env);

    if (!environmentNameValidation.valid) {
      return [];
    }

    const environmentId = this.#environmentIdByName(environmentNameValidation.normalized);

    if (!environmentId) {
      return [];
    }

    return this.testResultsByEnvironmentId(environmentId, options);
  }

  async testResultsByEnvironmentId(
    envId: string,
    options: {
      includeRetries?: boolean;
    } = { includeRetries: false },
  ) {
    const normalizedEnvId = this.#environmentIdForLookup(envId);

    if (!normalizedEnvId) {
      const validation = validateEnvironmentId(envId);
      const reason = validation.valid ? "unknown environment id" : validation.reason;

      throw new Error(`Invalid environmentId ${JSON.stringify(envId)}: ${reason}`);
    }
    const trs = this.indexTestResultByEnvironmentId.get(normalizedEnvId) ?? [];

    return options.includeRetries ? [...trs] : trs.filter((tr) => !tr.isRetry);
  }

  async allTestEnvGroups() {
    const trByTestCaseId: Record<string, TestResult[]> = {};

    for (const [, tr] of this.#testResults) {
      const testCaseId = tr?.testCase?.id;

      if (!testCaseId) {
        continue;
      }

      if (trByTestCaseId[testCaseId]) {
        trByTestCaseId[testCaseId].push(tr);
      } else {
        trByTestCaseId[testCaseId] = [tr];
      }
    }

    return Object.entries(trByTestCaseId).reduce((acc, [testCaseId, trs]) => {
      if (trs.length === 0) {
        return acc;
      }

      const { fullName, name } = trs[0];
      const envGroup: TestEnvGroup = {
        id: testCaseId,
        fullName,
        name,
        status: getWorstStatus(trs.map(({ status }) => status)) ?? "passed",
        testResultsByEnv: {},
      };

      trs.forEach((tr) => {
        const env = this.#environmentIdByTestResult(tr) ?? DEFAULT_ENVIRONMENT;

        envGroup.testResultsByEnv[env] = tr.id;
      });

      acc.push(envGroup);

      return acc;
    }, [] as TestEnvGroup[]);
  }

  // variables

  async allVariables() {
    return this.#reportVariables;
  }

  async envVariables(env: string) {
    const environmentNameValidation = validateEnvironmentName(env);

    if (!environmentNameValidation.valid) {
      return {
        ...this.#reportVariables,
      };
    }

    const environmentId = this.#environmentIdByName(environmentNameValidation.normalized);

    if (!environmentId) {
      return {
        ...this.#reportVariables,
      };
    }

    return this.envVariablesByEnvironmentId(environmentId);
  }

  async envVariablesByEnvironmentId(envId: string) {
    const normalizedEnvId = this.#environmentIdForLookup(envId);

    if (!normalizedEnvId) {
      const validation = validateEnvironmentId(envId);
      const reason = validation.valid ? "unknown environment id" : validation.reason;

      throw new Error(`Invalid environmentId ${JSON.stringify(envId)}: ${reason}`);
    }
    const envDescriptor = Object.prototype.hasOwnProperty.call(this.#environmentsConfig, normalizedEnvId)
      ? this.#environmentsConfig[normalizedEnvId]
      : undefined;

    return {
      ...this.#reportVariables,
      ...(envDescriptor?.variables ?? {}),
    };
  }

  dumpState(): AllureStoreDump {
    const storeDump: AllureStoreDump = {
      testResults: mapToObject(this.#testResults),
      attachments: mapToObject(this.#attachments),
      testCases: mapToObject(this.#testCases),
      fixtures: mapToObject(this.#fixtures),
      environments: this.#environments,
      reportVariables: this.#reportVariables,
      globalAttachmentIds: this.#globalAttachmentIds,
      globalErrors: this.#globalErrors,
      checkResults: mapToObject(this.#checkResultsById),
      indexAttachmentByTestResult: {},
      indexTestResultByHistoryId: {},
      indexTestResultByTestCase: {},
      indexAttachmentByFixture: {},
      indexFixturesByTestResult: {},
      indexKnownByHistoryId: {},
      qualityGateResults: this.#qualityGateResults,
      testResultIdsIngestOrder: this.#retrySubstore.ingestOrderIdsForDump(),
    };

    this.indexAttachmentByFixture.forEach((link, fxId) => {
      storeDump.indexAttachmentByFixture[fxId] = link.map((l) => l.id);
    });
    this.indexAttachmentByTestResult.forEach((links, trId) => {
      storeDump.indexAttachmentByTestResult[trId] = links.map((l) => l.id);
    });
    this.indexTestResultByHistoryId.forEach((trs, historyId) => {
      storeDump.indexTestResultByHistoryId[historyId] = trs.map((tr) => tr.id);
    });
    this.indexTestResultByTestCase.forEach((trs, tcId) => {
      storeDump.indexTestResultByTestCase[tcId] = trs.map((tr) => tr.id);
    });
    this.indexFixturesByTestResult.forEach((fixtures, trId) => {
      storeDump.indexFixturesByTestResult[trId] = fixtures.map((f) => f.id);
    });
    this.indexKnownByHistoryId.forEach((known, historyId) => {
      storeDump.indexKnownByHistoryId[historyId] = known;
    });

    return storeDump;
  }

  async restoreState(stateDump: AllureStoreDump, attachmentsContents: Record<string, ResultFile> = {}) {
    const {
      testResults,
      attachments,
      testCases,
      fixtures,
      reportVariables,
      environments,
      globalAttachmentIds = [],
      globalErrors = [],
      checkResults,
      indexAttachmentByTestResult = {},
      indexTestResultByHistoryId = {},
      indexTestResultByTestCase = {},
      indexAttachmentByFixture = {},
      indexFixturesByTestResult = {},
      indexKnownByHistoryId = {},
      qualityGateResults = [],
      testResultIdsIngestOrder = [],
    } = stateDump;
    const storedEnvironmentAliases = environments.flatMap((environmentValue) => {
      if (typeof environmentValue === "string") {
        return [{ id: environmentValue, name: environmentValue }];
      }

      const idValidation = validateEnvironmentId(environmentValue.id);

      if (!idValidation.valid) {
        return [];
      }

      return [
        {
          id: idValidation.normalized,
          name: environmentValue.name ?? idValidation.normalized,
        },
      ];
    });
    const normalizedEnvironments = environments
      .map((environmentValue) => {
        if (typeof environmentValue === "string") {
          return resolveStoredEnvironmentIdentity(
            {
              environmentName: environmentValue,
            },
            this.#environmentsConfig,
            {
              forcedEnvironment: this.#environment,
              fallbackToMatch: false,
            },
          );
        }

        return resolveStoredEnvironmentIdentity(
          {
            environment: environmentValue.id,
            environmentName: environmentValue.name,
          },
          this.#environmentsConfig,
          {
            forcedEnvironment: this.#environment,
            fallbackToMatch: false,
          },
        );
      })
      .filter(Boolean) as EnvironmentIdentity[];

    environments.forEach((environmentValue, index) => {
      const environmentParams =
        typeof environmentValue === "string"
          ? { environmentName: environmentValue }
          : { environment: environmentValue.id, environmentName: environmentValue.name };

      this.#assertAllowedStoredEnvironment(environmentParams, `restored environments[${index}]`, {
        fallbackToMatch: false,
      });
    });
    this.#addEnvironments([...storedEnvironmentAliases, ...normalizedEnvironments]);

    const envNameToId = new Map<string, string>();

    for (const { id, name } of this.#environments) {
      envNameToId.set(name, id);
      envNameToId.set(id, id);
    }

    Object.values(testResults).forEach((testResult) => {
      this.#testResults.set(testResult.id, testResult);
      const storedEnvKey = typeof testResult.environment === "string" ? testResult.environment : undefined;
      const envId =
        (storedEnvKey ? envNameToId.get(storedEnvKey) : undefined) ?? this.#environmentIdByTestResult(testResult);

      this.#assertAllowedEnvironmentId(envId, `restored testResults[${JSON.stringify(testResult.id)}]`);
      this.#setTestResultEnvironmentId(testResult, envId);
      this.#assignRetryHash(testResult, { environmentId: envId });
    });

    this.#retrySubstore.restoreIngestOrder(testResultIdsIngestOrder, (id) => this.#testResults.has(id));
    // Rebuild the O(1) ID lookup Set from the restored array index
    this.indexTestResultByEnvironmentId.forEach((trs, envId) => {
      this.#testResultIdsByEnvironmentId.set(envId, new Set(trs.map((tr) => tr.id)));
    });

    updateMapWithRecord(this.#checkResultsById, checkResults);
    updateMapWithRecord(this.#attachments, attachments);
    updateMapWithRecord(this.#testCases, testCases);
    updateMapWithRecord(this.#fixtures, fixtures);
    Object.entries(attachmentsContents).forEach(([id, content]) => {
      this.#restoreAttachmentContent(id, content);
    });
    this.#relinkRestoredAttachmentSteps();
    globalAttachmentIds.forEach((id) => {
      const attachment = this.#attachments.get(id);

      if (!attachment) {
        return;
      }

      this.#assertAllowedStoredEnvironment(
        {
          environment: (attachment as PluginGlobalAttachment).environment,
          environmentName: (attachment as PluginGlobalAttachment).environment,
        },
        `restored globalAttachments[${JSON.stringify(id)}]`,
        {
          fallbackToMatch: false,
        },
      );
      this.#globalAttachmentIds.push(id);
      this.#indexGlobalAttachment(attachment as PluginGlobalAttachment);
    });
    globalErrors.forEach((error, index) => {
      this.#assertAllowedStoredEnvironment(
        {
          environment: error.environment,
          environmentName: error.environment,
        },
        `restored globalErrors[${index}]`,
        {
          fallbackToMatch: false,
        },
      );
      this.#globalErrors.push(this.#indexGlobalError(error));
    });

    Object.assign(this.#reportVariables, reportVariables);
    Object.entries(indexAttachmentByTestResult).forEach(([trId, links]) => {
      const attachmentsLinks = links.map((id) => this.#attachments.get(id)).filter(Boolean);

      if (attachmentsLinks.length === 0) {
        return;
      }

      const existingLinks = this.indexAttachmentByTestResult.get(trId)!;

      if (!existingLinks) {
        this.indexAttachmentByTestResult.set(trId, attachmentsLinks as AttachmentLink[]);
        return;
      }

      existingLinks.push(...(attachmentsLinks as AttachmentLink[]));
    });
    Object.entries(indexTestResultByHistoryId).forEach(([historyId, trIds]) => {
      const trs = trIds.map((id) => this.#testResults.get(id)).filter(Boolean) as TestResult[];

      if (trs.length === 0) {
        return;
      }

      const existingTrs = this.indexTestResultByHistoryId.get(historyId);

      if (!existingTrs) {
        this.indexTestResultByHistoryId.set(historyId, trs);
        return;
      }

      existingTrs.push(...trs);
    });
    Object.entries(indexTestResultByTestCase).forEach(([tcId, trIds]) => {
      const trs = trIds.map((id) => this.#testResults.get(id)).filter(Boolean);

      if (trs.length === 0) {
        return;
      }

      const existingTrs = this.indexTestResultByTestCase.get(tcId);

      if (!existingTrs) {
        this.indexTestResultByTestCase.set(tcId, trs as TestResult[]);
        return;
      }

      existingTrs.push(...(trs as TestResult[]));
    });
    Object.entries(indexAttachmentByFixture).forEach(([fxId, attachmentIds]) => {
      const attachmentsLinks = attachmentIds.map((id) => this.#attachments.get(id)).filter(Boolean);

      if (attachmentsLinks.length === 0) {
        return;
      }

      const existingLinks = this.indexAttachmentByFixture.get(fxId);

      if (!existingLinks) {
        this.indexAttachmentByFixture.set(fxId, attachmentsLinks as AttachmentLink[]);
        return;
      }

      existingLinks.push(...(attachmentsLinks as AttachmentLink[]));
    });
    Object.entries(indexFixturesByTestResult).forEach(([trId, fixtureIds]) => {
      const fxs = fixtureIds.map((id) => this.#fixtures.get(id)).filter(Boolean);

      if (fxs.length === 0) {
        return;
      }

      const existingFixtures = this.indexFixturesByTestResult.get(trId);

      if (!existingFixtures) {
        this.indexFixturesByTestResult.set(trId, fxs as TestFixtureResult[]);
        return;
      }

      existingFixtures.push(...(fxs as TestFixtureResult[]));
    });
    Object.entries(indexKnownByHistoryId).forEach(([historyId, knownFailures]) => {
      const existingKnown = this.indexKnownByHistoryId.get(historyId);

      if (!existingKnown) {
        this.indexKnownByHistoryId.set(historyId, knownFailures);
        return;
      }

      existingKnown.push(...knownFailures);
    });
    this.#rebuildRetrySubstore();

    qualityGateResults.forEach((result, index) => {
      this.#assertAllowedStoredEnvironment(
        {
          environment: result.environment,
          environmentName: result.environment,
        },
        `restored qualityGateResults[${index}]`,
        {
          fallbackToMatch: false,
        },
      );
      this.#qualityGateResults.push(result);
    });
  }
}
