import type {
  AttachmentLink,
  AttachmentLinkLinked,
  HistoryDataPoint,
  HistoryTestResult,
  KnownTestFailure,
  Statistic,
  TestCase,
  TestFixtureResult,
  TestResult,
} from "@allurereport/core-api";
import { compareBy, nullsLast, ordinal, reverse } from "@allurereport/core-api";
import type { AllureStore, DefaultLabelsConfig, ResultFile } from "@allurereport/plugin-api";
import { md5 } from "@allurereport/plugin-api";
import type {
  RawFixtureResult,
  RawMetadata,
  RawTestResult,
  ReaderContext,
  ResultsVisitor,
} from "@allurereport/reader-api";
import type { EventEmitter } from "node:events";
import type { AllureStoreEvents } from "../utils/event.js";
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

export class DefaultAllureStore implements AllureStore, ResultsVisitor {
  readonly #testResults: Map<string, TestResult>;
  readonly #attachments: Map<string, AttachmentLink>;
  readonly #attachmentContents: Map<string, ResultFile>;
  readonly #testCases: Map<string, TestCase>;
  readonly #metadata: Map<string, any>;
  readonly #history: HistoryDataPoint[];
  readonly #known: KnownTestFailure[];
  readonly #fixtures: Map<string, TestFixtureResult>;
  readonly #defaultLabels: DefaultLabelsConfig = {};
  readonly #eventEmitter?: EventEmitter<AllureStoreEvents>;

  readonly indexTestResultByTestCase: Map<string, TestResult[]> = new Map<string, TestResult[]>();
  readonly indexLatestTestResultByHistoryId: Map<string, TestResult> = new Map<string, TestResult>();
  readonly indexTestResultByHistoryId: Map<string, TestResult[]> = new Map<string, TestResult[]>();
  readonly indexAttachmentByTestResult: Map<string, AttachmentLink[]> = new Map<string, AttachmentLink[]>();
  readonly indexAttachmentByFixture: Map<string, AttachmentLink[]> = new Map<string, AttachmentLink[]>();
  readonly indexFixturesByTestResult: Map<string, TestFixtureResult[]> = new Map<string, TestFixtureResult[]>();
  readonly indexKnownByHistoryId: Map<string, KnownTestFailure[]> = new Map<string, KnownTestFailure[]>();

  constructor(params?: {
    history?: HistoryDataPoint[];
    known?: KnownTestFailure[];
    eventEmitter?: EventEmitter<AllureStoreEvents>;
    defaultLabels?: DefaultLabelsConfig;
  }) {
    const { history = [], known = [], eventEmitter, defaultLabels } = params ?? {};

    this.#testResults = new Map<string, TestResult>();
    this.#attachments = new Map<string, AttachmentLink>();
    this.#attachmentContents = new Map<string, ResultFile>();
    this.#testCases = new Map<string, TestCase>();
    this.#metadata = new Map<string, any>();
    this.#fixtures = new Map<string, TestFixtureResult>();
    this.#history = [...history].sort(compareBy("timestamp", reverse(ordinal())));
    this.#known = [...known];
    this.#known.forEach((ktf) => index(this.indexKnownByHistoryId, ktf.historyId, ktf));
    this.#eventEmitter = eventEmitter;
    this.#defaultLabels = defaultLabels ?? {};
  }

  // test methods

  // visitor API

  async visitTestResult(raw: RawTestResult, context: ReaderContext): Promise<void> {
    const attachmentLinks: AttachmentLink[] = [];
    const testResult = testResultRawToState({
      stateData: {
        testCases: this.#testCases,
        attachments: this.#attachments,
        visitAttachmentLink: (link) => attachmentLinks.push(link),
      },
      raw,
      context,
      transformer: (tr) => {
        const defaultLabelsNames = Object.keys(this.#defaultLabels);

        if (!defaultLabelsNames.length) {
          return tr;
        }

        const newTr = { ...tr };

        defaultLabelsNames.forEach((labelName) => {
          if (!newTr.labels.find((label) => label.name === labelName)) {
            const defaultLabelValue = this.#defaultLabels[labelName];

            // concat method works both with single value and arrays, so we can use it here in this way
            ([] as string[]).concat(defaultLabelValue as string[]).forEach((labelValue) => {
              newTr.labels.push({
                name: labelName,
                value: labelValue,
              });
            });
          }
        });

        return newTr;
      },
    });

    this.#testResults.set(testResult.id, testResult);

    // retries
    if (testResult.historyId) {
      const maybeOther = this.indexLatestTestResultByHistoryId.get(testResult.historyId);
      if (maybeOther) {
        // if no start, means only duration is provided from result. In that case always use the latest (current).
        // Otherwise, compare by start timestamp, the latest wins.
        if (maybeOther.start === undefined || testResult.start === undefined || maybeOther.start < testResult.start) {
          this.indexLatestTestResultByHistoryId.set(testResult.historyId, testResult);
          maybeOther.hidden = true;
        } else {
          testResult.hidden = true;
        }
      } else {
        this.indexLatestTestResultByHistoryId.set(testResult.historyId, testResult);
      }
    }

    index(this.indexTestResultByTestCase, testResult.testCase?.id, testResult);
    index(this.indexTestResultByHistoryId, testResult.historyId, testResult);
    index(this.indexAttachmentByTestResult, testResult.id, ...attachmentLinks);
    this.#eventEmitter?.emit("testResult", testResult.id);
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
    this.#eventEmitter?.emit("testFixtureResult", testFixtureResult.id);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async visitAttachmentFile(resultFile: ResultFile, context: ReaderContext): Promise<void> {
    const originalFileName = resultFile.getOriginalFileName();
    const id = md5(originalFileName);

    // always override duplicate content
    this.#attachmentContents.set(id, resultFile);

    const maybeLink = this.#attachments.get(id);
    if (maybeLink) {
      // we need to preserve the same object since it's referenced in steps
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

    this.#eventEmitter?.emit("attachmentFile", id);
  }

  async visitMetadata(metadata: RawMetadata): Promise<void> {
    Object.keys(metadata).forEach((key) => this.#metadata.set(key, metadata[key]));
  }

  // state access API

  async allTestCases(): Promise<TestCase[]> {
    return Array.from(this.#testCases.values());
  }

  async allTestResults(
    options: {
      includeHidden: boolean;
    } = { includeHidden: false },
  ): Promise<TestResult[]> {
    const { includeHidden } = options;
    const result = Array.from(this.#testResults.values());
    return includeHidden ? result : result.filter((tr) => !tr.hidden);
  }

  async allAttachments(
    options: {
      includeMissed?: boolean;
      includeUnused?: boolean;
    } = {},
  ): Promise<AttachmentLink[]> {
    const { includeMissed = false, includeUnused = false } = options;
    const attachments = Array.from(this.#attachments.values());
    return attachments
      .filter((link) => (!includeMissed ? !link.missed : true))
      .filter((link) => (!includeUnused ? link.used : true));
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
    return this.#history;
  }

  async allKnownIssues(): Promise<KnownTestFailure[]> {
    return this.#known;
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

  async attachmentsByTrId(trId: string): Promise<AttachmentLink[]> {
    return this.indexAttachmentByTestResult.get(trId) ?? [];
  }

  async retriesByTrId(trId: string): Promise<TestResult[]> {
    const tr = await this.testResultById(trId);
    if (!tr || tr.hidden || !tr.historyId) {
      return [];
    }
    return (this.indexTestResultByHistoryId.get(tr.historyId) ?? [])
      .filter((r) => r.hidden)
      .sort(nullsLast(compareBy("start", reverse(ordinal()))));
  }

  async historyByTrId(trId: string): Promise<HistoryTestResult[]> {
    const tr = await this.testResultById(trId);

    if (!tr?.historyId) {
      return [];
    }

    return [...this.#history]
      .filter((dp) => !!dp.testResults[tr.historyId!])
      .map((dp) => ({ ...dp.testResults[tr.historyId!] }));
  }

  async fixturesByTrId(trId: string): Promise<TestFixtureResult[]> {
    return this.indexFixturesByTestResult.get(trId) ?? [];
  }

  // aggregate API

  async failedTestResults() {
    const allTestResults = await this.allTestResults();

    return allTestResults.filter(({ status }) => status === "failed" || status === "broken");
  }

  async unknownFailedTestResults() {
    const failedTestResults = await this.failedTestResults();

    if (!this.#known?.length) {
      return failedTestResults;
    }

    const knownHistoryIds = this.#known.map((ktf) => ktf.historyId);

    return failedTestResults.filter(({ historyId }) => historyId && !knownHistoryIds.includes(historyId));
  }

  async testResultsByLabel(labelName: string) {
    const results: { _: TestResult[]; [x: string]: TestResult[] } = {
      _: [],
    };

    const all = await this.allTestResults();
    all.forEach((test) => {
      const targetLabels = (test.labels ?? []).filter((label) => label.name === labelName);

      if (targetLabels.length === 0) {
        results._.push(test);
        return;
      }

      targetLabels.forEach((label) => {
        if (!results[label.value!]) {
          results[label.value!] = [];
        }

        results[label.value!].push(test);
      });
    });

    return results;
  }

  async testsStatistic() {
    const all = await this.allTestResults();

    return all.reduce(
      (acc, test) => {
        if (!acc[test.status]) {
          acc[test.status] = 0;
        }

        acc[test.status]!++;

        return acc;
      },
      { total: all.length } as Statistic,
    );
  }
}
