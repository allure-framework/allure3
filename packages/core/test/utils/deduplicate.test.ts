import type {
  DefaultTestStepResult,
  HistoryDataPoint,
  HistoryTestResult,
  TestCase,
  TestFixtureResult,
  TestResult,
  TestStepResult,
} from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { StringPool, deduplicateHistoryDataPoints, deduplicateStoreState } from "../../src/utils/deduplicate.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("memory");
  await story("deduplication");
  await label("coverage", "memory");
});

// Separate JSON.parse calls produce separate objects, as when history points are read line by line.
const parsePoint = (uuid: string, testResults: Record<string, HistoryTestResult>): HistoryDataPoint =>
  JSON.parse(
    JSON.stringify({
      uuid,
      name: "report",
      timestamp: 1,
      knownTestCaseIds: ["tc-1", "tc-2"],
      testResults,
      metrics: {},
      url: "",
    }),
  );

const historyTestResult = (id: string, overrides: Partial<HistoryTestResult> = {}): HistoryTestResult =>
  ({
    id,
    name: "test",
    fullName: "suite.test",
    environment: "default",
    status: "failed",
    message: "boom",
    trace: "at line 1",
    url: "",
    retryHash: "tc-1.hash",
    labels: [
      { name: "suite", value: "suite" },
      { name: "host", value: `agent-${id}` },
    ],
    ...overrides,
  }) as HistoryTestResult;

describe("StringPool", () => {
  it("should return values equal to the input and leave non-strings alone", () => {
    const stringPool = new StringPool();
    const object = { a: 1 };

    expect(stringPool.deduplicate("value")).toBe("value");
    expect(stringPool.deduplicate("value")).toBe("value");
    expect(stringPool.deduplicate(undefined)).toBeUndefined();
    expect(stringPool.deduplicate(object)).toBe(object);
  });
});

describe("deduplicateHistoryDataPoints", () => {
  it("should keep every history value unchanged", () => {
    const points = [
      parsePoint("run-1", { "tc-1.hash": historyTestResult("r1") }),
      parsePoint("run-2", { "tc-1.hash": historyTestResult("r2", { status: "passed" }) }),
    ];
    const before = JSON.stringify(points);

    deduplicateHistoryDataPoints(points);

    expect(JSON.stringify(points)).toBe(before);
  });

  it("should share equal label objects between history points", () => {
    const points = [
      parsePoint("run-1", { "tc-1.hash": historyTestResult("r1") }),
      parsePoint("run-2", { "tc-1.hash": historyTestResult("r2") }),
    ];

    deduplicateHistoryDataPoints(points);

    const [first, second] = points.map((point) => point.testResults["tc-1.hash"].labels!);

    expect(first[0]).toBe(second[0]);
    // host differs between runs, so those labels stay separate
    expect(first[1]).not.toBe(second[1]);
    expect(first[1]).toEqual({ name: "host", value: "agent-r1" });
    expect(second[1]).toEqual({ name: "host", value: "agent-r2" });
  });

  it("should share equal retry status strings between history points", () => {
    const points = [
      parsePoint("run-1", { "tc-1.hash": historyTestResult("r1", { retries: ["failed", "broken"] }) }),
      parsePoint("run-2", { "tc-1.hash": historyTestResult("r2", { retries: ["failed", "broken"] }) }),
    ];

    deduplicateHistoryDataPoints(points);

    const [first, second] = points.map((point) => point.testResults["tc-1.hash"].retries!);

    expect(first).toEqual(["failed", "broken"]);
    // every item keeps its own array, only the strings are shared
    expect(first).not.toBe(second);
    expect(first[0]).toBe(second[0]);
    expect(first[1]).toBe(second[1]);
  });

  it("should not merge labels that only look alike as strings", () => {
    const labels = [
      { name: "x" },
      { name: "x", value: "undefined" },
      { name: "y", value: "null" },
      { name: "y", value: null },
      { name: "z", value: "1", extra: true },
      { name: "z", value: "1" },
    ] as unknown as HistoryTestResult["labels"];
    const points = [
      parsePoint("run-1", { "tc-1.hash": historyTestResult("r1", { labels }) }),
      parsePoint("run-2", { "tc-1.hash": historyTestResult("r2", { labels }) }),
    ];
    const before = JSON.stringify(points);

    deduplicateHistoryDataPoints(points);

    expect(JSON.stringify(points)).toBe(before);
    expect(points[0].testResults["tc-1.hash"].labels).toEqual(labels);
    expect(points[1].testResults["tc-1.hash"].labels).toEqual(labels);
  });

  it("should leave frozen history items untouched", () => {
    const frozenLabels = Object.freeze([Object.freeze({ name: "suite", value: "suite" })]);
    const frozen = Object.freeze(historyTestResult("r1", { labels: frozenLabels as HistoryTestResult["labels"] }));
    const point = parsePoint("run-1", {});

    point.testResults["tc-1.hash"] = frozen;

    expect(() => deduplicateHistoryDataPoints([point])).not.toThrow();
    expect(point.testResults["tc-1.hash"]).toBe(frozen);
    expect(point.testResults["tc-1.hash"].labels).toBe(frozenLabels);
  });

  it("should tolerate points without test results or labels", () => {
    const point = parsePoint("run-1", { "tc-1.hash": historyTestResult("r1", { labels: undefined }) });

    delete (point as Partial<HistoryDataPoint>).knownTestCaseIds;

    expect(() => deduplicateHistoryDataPoints([point, { ...point, testResults: undefined! }])).not.toThrow();
    expect(point.testResults["tc-1.hash"].labels).toBeUndefined();
  });
});

// Separate JSON.parse calls produce separate objects, as when dump entries are parsed one by one.
const parseTestResult = (id: string, overrides: Partial<TestResult> = {}): TestResult =>
  JSON.parse(
    JSON.stringify({
      id,
      name: "test",
      fullName: "suite.test",
      status: "failed",
      environment: "default",
      descriptionHtml: "<p>shared description</p>",
      testCaseHash: "tc-1.hash",
      parametersHash: "params.hash",
      environmentHash: "env.hash",
      retryHash: "tc-1.hash",
      flaky: false,
      muted: false,
      known: false,
      isRetry: false,
      labels: [{ name: "suite", value: "suite" }],
      parameters: [{ name: "browser", value: "chrome", hidden: false, excluded: false, masked: false }],
      links: [{ name: "docs", url: "https://example.test/docs", type: "link" }],
      errors: [{ message: "boom", trace: "at line 1" }],
      titlePath: ["suite"],
      testCase: { id: "tc-1.hash", name: "test", externalId: "suite.test", fullName: "suite.test" },
      sourceMetadata: { readerId: "test", metadata: {} },
      steps: [
        {
          type: "step",
          stepId: "outer",
          name: "open page",
          status: "failed",
          message: "boom",
          trace: "at line 1",
          parameters: [{ name: "request", value: "GET /index.html", hidden: false, excluded: false, masked: false }],
          steps: [
            {
              type: "step",
              stepId: "inner",
              name: "nested",
              status: "failed",
              parameters: [],
              steps: [],
            },
          ],
        },
        {
          type: "attachment",
          link: {
            id: "att-1",
            name: "screenshot",
            originalFileName: "screenshot.png",
            ext: ".png",
            used: true,
            missed: false,
          },
        },
      ],
      ...overrides,
    }),
  );

const parseFixtureResult = (id: string): TestFixtureResult =>
  JSON.parse(
    JSON.stringify({
      id,
      testResultIds: ["tr-1"],
      type: "before",
      name: "beforeEach",
      status: "passed",
      sourceMetadata: { readerId: "test", metadata: {} },
      steps: [
        {
          type: "step",
          name: "open page",
          status: "passed",
          parameters: [{ name: "request", value: "GET /index.html", hidden: false, excluded: false, masked: false }],
          steps: [],
        },
      ],
    }),
  );

const parseTestCase = (id: string): TestCase =>
  JSON.parse(JSON.stringify({ id, name: "test", externalId: "suite.test", fullName: "suite.test" }));

const stepByName = (steps: TestStepResult[], name: string): DefaultTestStepResult =>
  steps.find((step) => step.type === "step" && step.name === name) as DefaultTestStepResult;

describe("deduplicateStoreState", () => {
  it("should keep every restored value unchanged", () => {
    const state = {
      testResults: { "tr-1": parseTestResult("tr-1") },
      fixtures: { "fx-1": parseFixtureResult("fx-1") },
      testCases: { "tc-1.hash": parseTestCase("tc-1.hash") },
    };
    const before = JSON.stringify(state);

    deduplicateStoreState(new StringPool(), state);

    expect(JSON.stringify(state)).toBe(before);
  });

  it("should share equal step, label and parameter strings between restored results", () => {
    const state = {
      testResults: { "tr-1": parseTestResult("tr-1"), "tr-2": parseTestResult("tr-2") },
      fixtures: {},
      testCases: {},
    };

    deduplicateStoreState(new StringPool(), state);

    const [first, second] = [state.testResults["tr-1"], state.testResults["tr-2"]];
    const [firstStep, secondStep] = [stepByName(first.steps, "open page"), stepByName(second.steps, "open page")];

    expect(firstStep).not.toBe(secondStep);
    expect(firstStep.name).toBe(secondStep.name);
    expect(firstStep.parameters[0].name).toBe(secondStep.parameters[0].name);
    expect(firstStep.parameters[0].value).toBe(secondStep.parameters[0].value);
    expect(firstStep.message).toBe(secondStep.message);
    expect(firstStep.trace).toBe(secondStep.trace);
    expect(first.labels[0].name).toBe(second.labels[0].name);
    expect(first.labels[0].value).toBe(second.labels[0].value);
    expect(first.parameters[0].value).toBe(second.parameters[0].value);
    expect(first.links[0].url).toBe(second.links[0].url);
    expect(first.errors![0].message).toBe(second.errors![0].message);
    expect(first.descriptionHtml).toBe(second.descriptionHtml);
    expect(first.titlePath![0]).toBe(second.titlePath![0]);
  });

  it("should walk nested steps, retries, fixtures and test cases", () => {
    const state = {
      testResults: {
        "tr-1": parseTestResult("tr-1", {
          retries: [parseTestResult("tr-0", { name: "retry" })],
        }),
        "tr-2": parseTestResult("tr-2"),
      },
      fixtures: { "fx-1": parseFixtureResult("fx-1") },
      testCases: { "tc-1.hash": parseTestCase("tc-1.hash") },
    };

    deduplicateStoreState(new StringPool(), state);

    const [first, second] = [state.testResults["tr-1"], state.testResults["tr-2"]];
    const attachment = first.steps.find((step) => step.type === "attachment")!;
    const fixtureStep = stepByName(state.fixtures["fx-1"].steps, "open page");

    expect(stepByName(first.steps[0].type === "step" ? first.steps[0].steps : [], "nested").name).toBe(
      stepByName(second.steps[0].type === "step" ? second.steps[0].steps : [], "nested").name,
    );
    expect(stepByName(first.retries![0].steps, "open page").name).toBe(stepByName(second.steps, "open page").name);
    expect(attachment.type === "attachment" ? attachment.link.name : undefined).toBe("screenshot");
    expect(fixtureStep.name).toBe(stepByName(second.steps, "open page").name);
    expect(fixtureStep.parameters[0].value).toBe(stepByName(second.steps, "open page").parameters[0].value);
    expect(state.testCases["tc-1.hash"].name).toBe(first.testCase!.name);
  });

  it("should leave frozen state untouched", () => {
    const frozenStep = Object.freeze({
      type: "step",
      name: "open page",
      status: "passed",
      parameters: [],
      steps: [],
    } as TestStepResult);
    const withFrozenStep = parseTestResult("tr-1");

    withFrozenStep.steps = [frozenStep];

    const frozenResult = Object.freeze(parseTestResult("tr-2"));
    const state = {
      testResults: { "tr-1": withFrozenStep, "tr-2": frozenResult },
      fixtures: {},
      testCases: {},
    };

    expect(() => deduplicateStoreState(new StringPool(), state)).not.toThrow();
    expect(state.testResults["tr-1"].steps[0]).toBe(frozenStep);
    expect(state.testResults["tr-2"]).toBe(frozenResult);
  });
});
