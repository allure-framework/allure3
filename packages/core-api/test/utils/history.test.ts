import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { HistoryDataPoint, HistoryTestResult, TestResult } from "../../src/index.js";
import {
  createHistoryTestResultLookup,
  normalizeHistoryDataPoint,
  normalizeHistoryDataPointUrls,
  selectHistoryTestResults,
} from "../../src/utils/history.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("history");
  await story("history");
  await label("coverage", "history");
});

describe("history utils", () => {
  it("should select the first matching history candidate for each datapoint", () => {
    const primaryHistoryResult = { id: "primary", name: "primary", status: "passed", url: "https://primary" };
    const fallbackHistoryResult = { id: "fallback", name: "fallback", status: "failed", url: "https://fallback" };
    const historyDataPoints = [
      {
        uuid: "first",
        name: "Entry 1",
        timestamp: 1,
        knownTestCaseIds: [],
        metrics: {},
        url: "",
        testResults: {
          primary: primaryHistoryResult,
          fallback: fallbackHistoryResult,
        },
      },
      {
        uuid: "second",
        name: "Entry 2",
        timestamp: 2,
        knownTestCaseIds: [],
        metrics: {},
        url: "",
        testResults: {
          fallback: fallbackHistoryResult,
        },
      },
    ];

    expect(selectHistoryTestResults(historyDataPoints, ["primary", "fallback"])).toEqual([
      primaryHistoryResult,
      fallbackHistoryResult,
    ]);
  });

  it("should ignore missing history test results while selecting candidates", () => {
    const historyDataPoints = [
      {
        uuid: "first",
        name: "Entry 1",
        timestamp: 1,
        knownTestCaseIds: [],
        metrics: {},
        url: "",
      } as unknown as HistoryDataPoint,
    ];

    expect(selectHistoryTestResults(historyDataPoints, ["primary"])).toEqual([]);
  });

  it("should not mutate selected history entries", () => {
    const historyTestResult = { id: "primary", name: "primary", status: "passed", url: "https://history" };
    const historyDataPoints = [
      {
        uuid: "first",
        name: "Entry 1",
        timestamp: 1,
        knownTestCaseIds: [],
        metrics: {},
        url: "https://report",
        testResults: {
          primary: historyTestResult,
        },
      },
    ];

    const [selectedHistoryTestResult] = selectHistoryTestResults(historyDataPoints, ["primary"]);

    expect(selectedHistoryTestResult).toBe(historyTestResult);
    expect(selectedHistoryTestResult.url).toBe("https://history");
  });

  describe("read-only legacy history lookup", () => {
    const point = (testResults: Record<string, HistoryTestResult>): HistoryDataPoint => ({
      uuid: "point",
      name: "Entry",
      timestamp: 1,
      knownTestCaseIds: [],
      metrics: {},
      url: "",
      testResults,
    });
    const historical = (id: string, environment?: string): HistoryTestResult => ({
      id,
      name: id,
      status: "passed",
      url: "",
      environment,
    });
    const current = (retryHash: string, legacyHistoryId?: string, options: Partial<TestResult> = {}): TestResult =>
      ({
        id: retryHash,
        name: retryHash,
        status: "passed",
        retryHash,
        sourceMetadata: { readerId: "reader", metadata: {}, legacyHistoryId },
        ...options,
      }) as TestResult;

    it("selects canonical and legacy entries from mixed historical points", () => {
      const result = current("canonical", "legacy");
      const canonical = historical("canonical");
      const legacy = historical("legacy");
      const lookup = createHistoryTestResultLookup([result]);

      expect(lookup(point({ canonical }), result)).toBe(canonical);
      expect(lookup(point({ legacy }), result)).toBe(legacy);
    });

    it("prefers a canonical entry over the supplied legacy alias", () => {
      const result = current("canonical", "legacy");
      const canonical = historical("canonical");
      const lookup = createHistoryTestResultLookup([result]);

      expect(lookup(point({ canonical, legacy: historical("legacy") }), result)).toBe(canonical);
    });

    it("does not fall back when no explicit legacy alias was supplied", () => {
      const result = current("canonical");

      expect(createHistoryTestResultLookup([result])(point({ legacy: historical("legacy") }), result)).toBeUndefined();
    });

    it("rejects legacy fallback for named current or source environments", () => {
      const namedCurrent = current("canonical", "legacy", { environment: "staging" });
      const defaultCurrent = current("canonical", "legacy");
      const legacyPoint = point({ legacy: historical("legacy") });

      expect(createHistoryTestResultLookup([namedCurrent])(legacyPoint, namedCurrent)).toBeUndefined();
      expect(
        createHistoryTestResultLookup([defaultCurrent])(
          point({ legacy: historical("legacy", "staging") }),
          defaultCurrent,
        ),
      ).toBeUndefined();
    });

    it("rejects legacy fallback when a named environment hash is present", () => {
      const result = current("canonical", "legacy", { environmentHash: "dynamic" });

      expect(createHistoryTestResultLookup([result])(point({ legacy: historical("legacy") }), result)).toBeUndefined();
    });

    it("never assigns history to a dynamic result without a canonical identity", () => {
      const result = current("unused", "legacy", { retryHash: null });
      expect(createHistoryTestResultLookup([result])(point({ legacy: historical("legacy") }), result)).toBeUndefined();
    });

    it("compares historical records across the transition using the current explicit alias", () => {
      const result = current("canonical", "legacy");
      const legacy = { ...historical("old"), retryHash: "legacy" };
      const canonical = { ...historical("recent"), retryHash: "canonical" };
      const lookup = createHistoryTestResultLookup([result]);

      expect(lookup(point({ canonical }), legacy)).toBe(canonical);
      expect(lookup(point({ legacy }), canonical)).toBe(legacy);
      expect(lookup(point({ canonical, legacy }), legacy)).toBe(canonical);
      expect(lookup(point({ canonical }), { ...legacy, environment: "qa" })).toBeUndefined();
    });

    it("skips a shared legacy alias", () => {
      const first = current("canonical-a", "legacy");
      const second = current("canonical-b", "legacy");
      const lookup = createHistoryTestResultLookup([first, second]);
      const legacyPoint = point({ legacy: historical("legacy") });

      expect(lookup(legacyPoint, first)).toBeUndefined();
      expect(lookup(legacyPoint, second)).toBeUndefined();
    });

    it("rejects a legacy alias that is another current canonical key", () => {
      const canonicalOwner = current("legacy");
      const aliasedResult = current("canonical", "legacy");
      const lookup = createHistoryTestResultLookup([canonicalOwner, aliasedResult]);

      expect(lookup(point({ legacy: historical("legacy") }), aliasedResult)).toBeUndefined();
    });

    it("allows retries with the same canonical key and legacy alias", () => {
      const firstRetry = current("canonical", "legacy");
      const secondRetry = current("canonical", "legacy");
      const legacy = historical("legacy");
      const lookup = createHistoryTestResultLookup([firstRetry, secondRetry]);

      expect(lookup(point({ legacy }), firstRetry)).toBe(legacy);
      expect(lookup(point({ legacy }), secondRetry)).toBe(legacy);
    });

    it("supports prototype-like canonical and legacy keys", () => {
      const canonicalResult = current("__proto__");
      const legacyResult = current("canonical", "constructor");
      const canonicalResults = JSON.parse(
        '{"__proto__":{"id":"canonical","name":"canonical","status":"passed","url":""}}',
      );

      expect(createHistoryTestResultLookup([canonicalResult])(point(canonicalResults), canonicalResult)).toMatchObject({
        id: "canonical",
      });
      const legacy = historical("constructor");
      expect(createHistoryTestResultLookup([legacyResult])(point({ constructor: legacy }), legacyResult)).toBe(legacy);
    });

    it("does not mutate historical points while looking up legacy entries", () => {
      const result = current("canonical", "legacy");
      const historyPoint = point({ legacy: historical("legacy") });
      const original = structuredClone(historyPoint);

      expect(createHistoryTestResultLookup([result])(historyPoint, result)).toBe(historyPoint.testResults.legacy);
      expect(historyPoint).toEqual(original);
    });

    it("ignores the deprecated fallback test-case label", () => {
      const result = current("canonical", undefined, {
        labels: [{ name: "_fallbackTestCaseId", value: "legacy" }],
      });

      expect(createHistoryTestResultLookup([result])(point({ legacy: historical("legacy") }), result)).toBeUndefined();
    });
  });

  it("should normalize nested history urls from datapoint url when needed", () => {
    const historyTestResult = { id: "primary", name: "primary", status: "passed", url: "" };
    const historyDataPoint = {
      uuid: "first",
      name: "Entry 1",
      timestamp: 1,
      knownTestCaseIds: [],
      metrics: {},
      url: "https://history",
      testResults: {
        primary: historyTestResult,
      },
    };

    expect(normalizeHistoryDataPointUrls(historyDataPoint)).toEqual({
      ...historyDataPoint,
      testResults: {
        primary: {
          ...historyTestResult,
          retryHash: "primary",
          url: "https://history",
        },
      },
    });
  });

  it("normalizes legacy history entries to their map retry hash", () => {
    const normalized = normalizeHistoryDataPoint({
      uuid: "first",
      name: "Entry 1",
      timestamp: 1,
      knownTestCaseIds: [],
      metrics: {},
      url: "",
      testResults: {
        canonical: {
          id: "result",
          name: "test",
          status: "passed",
          url: "",
          historyId: "legacy",
        } as never,
      },
    });

    expect(normalized.testResults.canonical).toMatchObject({ retryHash: "canonical" });
    expect(normalized.testResults.canonical).not.toHaveProperty("historyId");
  });

  it("should normalize missing history fields", () => {
    const historyDataPoint = {
      uuid: "first",
      name: "Entry 1",
      timestamp: 1,
    } as unknown as HistoryDataPoint;

    expect(normalizeHistoryDataPoint(historyDataPoint)).toEqual({
      ...historyDataPoint,
      knownTestCaseIds: [],
      metrics: {},
      testResults: {},
      url: "",
    });
  });
});
