import { extname } from "node:path";

/* eslint max-lines: off */
import {
  type AllureHistory,
  type AttachmentLink,
  type AttachmentLinkLinked,
  type DefaultLabelsConfig,
  DEFAULT_ENVIRONMENT,
  DEFAULT_ENVIRONMENT_IDENTITY,
  type EnvironmentIdentity,
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
  compareBy,
  createDictionary,
  getHistoryIdCandidates,
  getWorstStatus,
  nullsLast,
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
} from "../utils/environment.js";
import { isFlaky } from "../utils/flaky.js";
import { getStatusTransition } from "../utils/new.js";
import { testFixtureResultRawToState, testResultRawToState } from "./convert.js";

const index = <T>(indexMap: Map<string, T[]>, key: string | undefined, ...items: T[]) => {
  if (key) {
    if (!indexMap.has(key)) {
      indexMap.set(key, []);
    }

    const current = indexMap.get(key)!;

    current.push(...items);
  }
};

const wasStartedEarlier = (first: TestResult, second: TestResult) =>
  first.start === undefined || second.start === undefined || first.start < second.start;

const hidePreviousAttemptByEnvironment = (
  state: Map<string, Map<string, TestResult>>,
  testResult: TestResult,
  environmentId: string | undefined,
) => {
  const { historyId } = testResult;

  if (environmentId) {
    if (!state.has(environmentId)) {
      state.set(environmentId, new Map());
    }

    if (historyId) {
      const historyIdToLastAttemptResult = state.get(environmentId)!;
      const currentLastAttemptResult = historyIdToLastAttemptResult.get(historyId);

      if (currentLastAttemptResult) {
        if (wasStartedEarlier(currentLastAttemptResult, testResult)) {
          historyIdToLastAttemptResult.set(historyId, testResult);
          currentLastAttemptResult.hidden = true;
        } else {
          testResult.hidden = true;
        }
      } else {
        historyIdToLastAttemptResult.set(historyId, testResult);
      }
    }
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

  readonly indexTestResultByTestCase: Map<string, TestResult[]> = new Map<string, TestResult[]>();
  readonly indexTestResultByEnvironmentId: Map<string, TestResult[]> = new Map<string, TestResult[]>();
  readonly indexLatestEnvTestResultByHistoryId: Map<string, Map<string, TestResult>> = new Map();
  readonly indexTestResultByHistoryId: Map<string, TestResult[]> = new Map<string, TestResult[]>();
  readonly indexAttachmentByTestResult: Map<string, AttachmentLink[]> = new Map<string, AttachmentLink[]>();
  readonly indexAttachmentByFixture: Map<string, AttachmentLink[]> = new Map<string, AttachmentLink[]>();
  readonly indexFixturesByTestResult: Map<string, TestFixtureResult[]> = new Map<string, TestFixtureResult[]>();
  readonly indexKnownByHistoryId: Map<string, KnownTestFailure[]> = new Map<string, KnownTestFailure[]>();

  #globalAttachmentIds: string[] = [];
  #globalErrors: TestError[] = [];
  #globalExitCode: ExitCode | undefined;
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

    this.#addEnvironments(environments);

    this.#realtimeSubscriber?.onQualityGateResults(async (results: QualityGateValidationResult[]) => {
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
    this.#realtimeSubscriber?.onGlobalExitCode(async (exitCode: ExitCode) => {
      this.#globalExitCode = exitCode;
    });
    this.#realtimeSubscriber?.onGlobalError(async (error: TestError) => {
      this.#globalErrors.push(error);
    });
    this.#realtimeSubscriber?.onGlobalAttachment(async ({ attachment, fileName }) => {
      const originalFileName = attachment.getOriginalFileName();
      const attachmentLink: AttachmentLinkLinked = {
        id: md5(originalFileName),
        name: fileName || originalFileName,
        missed: false,
        used: true,
        ext: attachment.getExtension(),
        contentType: attachment.getContentType(),
        contentLength: attachment.getContentLength(),
        originalFileName,
      };

      this.#attachments.set(attachmentLink.id, attachmentLink);
      this.#attachmentContents.set(attachmentLink.id, attachment);
      this.#globalAttachmentIds.push(attachmentLink.id);
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

    envs.forEach(({ id }) => {
      if (!this.indexLatestEnvTestResultByHistoryId.has(id)) {
        this.indexLatestEnvTestResultByHistoryId.set(id, new Map());
      }
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

    const existing = this.indexTestResultByEnvironmentId.get(environmentId);
    if (existing?.some((tr) => tr.id === testResult.id)) {
      return;
    }

    index(this.indexTestResultByEnvironmentId, environmentId, testResult);
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

  // history state

  async readHistory(): Promise<HistoryDataPoint[]> {
    if (!this.#history) {
      return [];
    }

    this.#historyPoints = (await this.#history.readHistory()) ?? [];
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

  async allGlobalAttachments(): Promise<AttachmentLinkLinked[]> {
    return this.#globalAttachmentIds.reduce((acc, id) => {
      const attachment = this.#attachments.get(id);

      if (!attachment) {
        return acc;
      }

      acc.push(attachment as AttachmentLinkLinked);

      return acc;
    }, [] as AttachmentLinkLinked[]);
  }

  // test methods

  // visitor API

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
        const match = Object.entries(this.#environmentsConfig).find(([, { matcher }]) =>
          matcher({ labels: testResult.labels }),
        );

        if (!match) {
          return DEFAULT_ENVIRONMENT_IDENTITY;
        }

        const [id, descriptor] = match;

        return { id, name: descriptor.name ?? id };
      })();

    testResult.environment = environmentIdentity.name;
    this.#addEnvironments([environmentIdentity]);

    const trHistory = await this.historyByTr(testResult);

    if (trHistory !== undefined) {
      testResult.transition = getStatusTransition(testResult, trHistory);
      testResult.flaky = isFlaky(testResult, trHistory);
    }

    this.#testResults.set(testResult.id, testResult);
    this.#setTestResultEnvironmentId(testResult, environmentIdentity.id);

    hidePreviousAttemptByEnvironment(this.indexLatestEnvTestResultByHistoryId, testResult, environmentIdentity.id);

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

    this.#realtimeDispatcher?.sendAttachmentFile(id);
  }

  async visitMetadata(metadata: RawMetadata): Promise<void> {
    Object.keys(metadata).forEach((key) => {
      this.#metadata.set(key, metadata[key]);
    });
  }

  async visitGlobals(globals: RawGlobals): Promise<void> {
    const { errors, attachments } = globals;

    this.#globalErrors.push(...errors);

    attachments.forEach((attachment) => {
      const originalFileName = attachment.originalFileName!;
      const id = md5(originalFileName);
      const attachmentLink: AttachmentLinkLinked = {
        id,
        name: attachment?.name || originalFileName,
        originalFileName,
        ext: extname(originalFileName),
        used: true,
        missed: false,
        contentType: attachment?.contentType,
      };

      this.#attachments.set(id, attachmentLink);
      this.#globalAttachmentIds.push(id);
    });
  }

  // state access API

  async allTestCases(): Promise<TestCase[]> {
    return Array.from(this.#testCases.values());
  }

  async allTestResults(
    options: {
      includeHidden?: boolean;
      filter?: TestResultFilter;
    } = { includeHidden: false },
  ): Promise<TestResult[]> {
    const { includeHidden = false, filter } = options;
    const result: TestResult[] = [];

    for (const [, tr] of this.#testResults) {
      if (!includeHidden && tr.hidden) {
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

      for (const tr of Object.values(dp.testResults)) {
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

    const historicalIds = new Set(allHistoryDps.flatMap((dp) => Object.keys(dp.testResults)));
    const newTrs: TestResult[] = [];

    for (const [, tr] of this.#testResults) {
      if (tr.hidden) {
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

  async retriesByTr(tr?: TestResult): Promise<TestResult[]> {
    const retries: TestResult[] = [];

    if (!tr || tr.hidden || !tr.historyId) {
      return retries;
    }

    const trByHistoryId = this.indexTestResultByHistoryId.get(tr.historyId);

    if (!trByHistoryId) {
      return retries;
    }

    for (const r of trByHistoryId) {
      // hidden should be true for a retry
      // the environment should be the same as the original test result
      if (!r.hidden || tr.environment !== r.environment) {
        continue;
      }

      retries.push(r);
    }

    return retries.sort(nullsLast(compareBy("start", reverse(ordinal()))));
  }

  async retriesByTrId(trId: string): Promise<TestResult[]> {
    const tr = await this.testResultById(trId);

    return this.retriesByTr(tr);
  }

  async historyByTr(tr: TestResult): Promise<HistoryTestResult[] | undefined> {
    if (!this.#history) {
      return undefined;
    }

    const historyIdCandidates = getHistoryIdCandidates(tr);

    if (historyIdCandidates.length === 0) {
      return [];
    }

    return selectHistoryTestResults(this.#historyPoints, historyIdCandidates);
  }

  async historyByTrId(trId: string): Promise<HistoryTestResult[] | undefined> {
    const tr = await this.testResultById(trId);

    if (!tr) {
      return undefined;
    }

    return this.historyByTr(tr);
  }

  async fixturesByTrId(trId: string): Promise<TestFixtureResult[]> {
    return this.indexFixturesByTestResult.get(trId) ?? [];
  }

  // aggregate API

  async failedTestResults() {
    const failedTrs: TestResult[] = [];

    for (const [, tr] of this.#testResults) {
      if (tr.hidden) {
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
      if (test.hidden) {
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
      if (tr.hidden) {
        continue;
      }

      if (filter && !filter(tr)) {
        continue;
      }

      statistic.total++;

      // This is fine because retriesByTr does not contain any async operations
      const retries = await this.retriesByTr(tr);

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
      includeHidden?: boolean;
    } = { includeHidden: false },
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
      includeHidden?: boolean;
    } = { includeHidden: false },
  ) {
    const normalizedEnvId = this.#environmentIdForLookup(envId);

    if (!normalizedEnvId) {
      const validation = validateEnvironmentId(envId);
      const reason = validation.valid ? "unknown environment id" : validation.reason;

      throw new Error(`Invalid environmentId ${JSON.stringify(envId)}: ${reason}`);
    }
    const trs = this.indexTestResultByEnvironmentId.get(normalizedEnvId) ?? [];

    return options.includeHidden ? [...trs] : trs.filter((tr) => !tr.hidden);
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
      indexLatestEnvTestResultByHistoryId: {},
      indexAttachmentByTestResult: {},
      indexTestResultByHistoryId: {},
      indexTestResultByTestCase: {},
      indexAttachmentByFixture: {},
      indexFixturesByTestResult: {},
      indexKnownByHistoryId: {},
      qualityGateResults: this.#qualityGateResults,
    };

    this.indexLatestEnvTestResultByHistoryId.forEach((envMap, environmentId) => {
      if (!storeDump.indexLatestEnvTestResultByHistoryId[environmentId]) {
        storeDump.indexLatestEnvTestResultByHistoryId[environmentId] = {};
      }

      envMap.forEach((tr, historyId) => {
        (storeDump.indexLatestEnvTestResultByHistoryId[environmentId] as Record<string, string>)[historyId] = tr.id;
      });
    });
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
      indexAttachmentByTestResult = {},
      indexTestResultByHistoryId = {},
      indexTestResultByTestCase = {},
      indexLatestEnvTestResultByHistoryId = {},
      indexAttachmentByFixture = {},
      indexFixturesByTestResult = {},
      indexKnownByHistoryId = {},
      qualityGateResults = [],
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

      this.#setTestResultEnvironmentId(testResult, envId);
    });

    updateMapWithRecord(this.#attachments, attachments);
    updateMapWithRecord(this.#testCases, testCases);
    updateMapWithRecord(this.#fixtures, fixtures);
    updateMapWithRecord(this.#attachmentContents, attachmentsContents);
    this.#globalAttachmentIds.push(...globalAttachmentIds);
    this.#globalErrors.push(...globalErrors);

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
    this.#environments.forEach(({ id }) => {
      if (!this.indexLatestEnvTestResultByHistoryId.has(id)) {
        this.indexLatestEnvTestResultByHistoryId.set(id, new Map());
      }
    });

    const latestAttemptsEntries = Object.entries(indexLatestEnvTestResultByHistoryId);
    const hasNestedLatestAttempts = latestAttemptsEntries.some(
      ([, value]) => typeof value === "object" && value !== null,
    );

    if (hasNestedLatestAttempts) {
      latestAttemptsEntries.forEach(([environmentId, historyIds]) => {
        const environmentIdValidation = validateEnvironmentId(environmentId);

        if (!environmentIdValidation.valid || typeof historyIds !== "object" || historyIds === null) {
          return;
        }

        const normalizedEnvironmentId = environmentIdValidation.normalized;

        Object.values(historyIds as Record<string, string>).forEach((trId) => {
          const tr = this.#testResults.get(trId);

          if (!tr) {
            return;
          }

          hidePreviousAttemptByEnvironment(this.indexLatestEnvTestResultByHistoryId, tr, normalizedEnvironmentId);
        });
      });
    } else {
      Object.entries(indexLatestEnvTestResultByHistoryId as Record<string, string>).forEach(
        ([historyId, latestTrId]) => {
          const trIdsForHistory = indexTestResultByHistoryId[historyId] ?? [];
          const storedLatestTr = this.#testResults.get(latestTrId);
          const storedLatestEnvironmentId = storedLatestTr
            ? (this.#environmentIdByTestResult(storedLatestTr) ?? DEFAULT_ENVIRONMENT)
            : undefined;

          if (storedLatestTr && storedLatestEnvironmentId) {
            hidePreviousAttemptByEnvironment(
              this.indexLatestEnvTestResultByHistoryId,
              storedLatestTr,
              storedLatestEnvironmentId,
            );
          }

          for (const trId of trIdsForHistory) {
            if (trId === latestTrId) {
              continue;
            }

            const tr = this.#testResults.get(trId);

            if (!tr) {
              continue;
            }

            const environmentId = this.#environmentIdByTestResult(tr) ?? DEFAULT_ENVIRONMENT;

            if (storedLatestEnvironmentId && environmentId === storedLatestEnvironmentId) {
              continue;
            }

            hidePreviousAttemptByEnvironment(this.indexLatestEnvTestResultByHistoryId, tr, environmentId);
          }
        },
      );
    }

    this.#qualityGateResults.push(...qualityGateResults);
  }
}
