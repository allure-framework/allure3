import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { FlakinessOptions, HistoryTestResult, TestResult, TestStatus } from "../../src/index.js";
import { getTestFlakiness } from "../../src/index.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("flakiness");
  await story("retry failure-rate classification");
  await label("coverage", "flakiness");
});

const statuses: Record<string, TestStatus> = { P: "passed", F: "failed", B: "broken", S: "skipped", U: "unknown" };
const makeInput = (sequence: string, historicalSequences: (string | undefined)[] = []) => {
  const current: TestResult = {
    id: "current",
    name: "test",
    status: statuses[sequence.at(-1)!],
    testCaseHash: "case",
    parametersHash: "parameters",
    environmentHash: null,
    retryHash: "retry",
    flaky: false,
    muted: false,
    known: false,
    isRetry: false,
    labels: [],
    parameters: [],
    links: [],
    steps: [],
    sourceMetadata: { readerId: "test", metadata: {} },
  };
  // Current retries are newest first; persisted history retries are chronological.
  current.retries = [...sequence.slice(0, -1)].reverse().map((symbol, index) => ({
    ...current,
    id: `retry-${index}`,
    status: statuses[symbol],
    isRetry: true,
  }));
  const history: (HistoryTestResult | undefined)[] = historicalSequences.map((run, index) =>
    run === undefined
      ? undefined
      : {
          id: `history-${index}`,
          name: "test",
          status: statuses[run.at(-1)!],
          url: "",
          retries: [...run.slice(0, -1)].map((symbol) => statuses[symbol]),
        },
  );
  return { current, history };
};
const classify = (sequence: string, history: (string | undefined)[] = [], options: FlakinessOptions = {}) => {
  const input = makeInput(sequence, history);
  return getTestFlakiness(input.current, input.history, { algorithm: "retry-failure-rate", ...options });
};

describe("retry failure-rate evidence", () => {
  it.each([
    { name: "assesses a clean current pass without history", current: "P", history: [], expected: false },
    { name: "assesses current retry recovery without history", current: "FP", history: [], expected: true },
    {
      name: "keeps one failure with ten passes below the cutoff",
      current: "FP",
      history: Array(9).fill("P"),
      options: { stabilizationPeriod: 10 },
      expected: false,
    },
    {
      name: "detects four failures with ten passes",
      current: "FBFFP",
      history: Array(9).fill("P"),
      options: { stabilizationPeriod: 10 },
      expected: true,
    },
    {
      name: "does not flag exact ten-percent equality",
      current: "FP",
      history: Array(8).fill("P"),
      options: { stabilizationPeriod: 10 },
      expected: false,
    },
    { name: "detects mixed failure statuses without a passed attempt", current: "FBF", history: [], expected: true },
    {
      name: "uses historical mixed failure statuses for a uniform current failure",
      current: "F",
      history: ["FB"],
      expected: true,
    },
    { name: "counts uniform current failures without history", current: "FF", history: [], expected: true },
    { name: "counts uniform broken attempts without history", current: "BB", history: [], expected: true },
    { name: "counts separate uniform failure executions", current: "F", history: ["B", "F"], expected: true },
    {
      name: "ignores skipped and unknown attempts while counting uniform failures",
      current: "FUSF",
      history: [],
      expected: true,
    },
    {
      name: "counts a failing current run alongside historical recovery",
      current: "FFFF",
      history: ["FP"],
      expected: true,
    },
    { name: "counts a pass anywhere in an execution", current: "PF", history: [], expected: true },
    {
      name: "detects outcome alternation across executions",
      current: "F",
      history: ["P", "F", "P", "F"],
      expected: true,
    },
    {
      name: "detects uniform retry failures between passing executions",
      current: "FF",
      history: ["P", "P", "P"],
      expected: true,
    },
  ] as { name: string; current: string; history: string[]; options?: FlakinessOptions; expected: boolean }[])(
    "$name",
    ({ current, history, options, expected }) => {
      const result = classify(current, history, options);

      expect(result).toBe(expected);
    },
  );

  it.each([
    { threshold: 0, expected: true },
    { threshold: 0.49, expected: true },
    { threshold: 0.5, expected: false },
    { threshold: 1, expected: false },
  ])("requires the rate to strictly exceed $threshold", ({ threshold, expected }) => {
    const result = classify("FP", [], { retryFailureThreshold: threshold });

    expect(result).toBe(expected);
  });

  it.each([
    { threshold: 0.5, expected: true },
    { threshold: 0.7, expected: false },
  ])("ignores skipped and unknown attempts in both counts at cutoff $threshold", ({ threshold, expected }) => {
    const result = classify("FUBSP", [], { retryFailureThreshold: threshold });

    expect(result).toBe(expected);
  });

  it.each([
    { threshold: 0.15, expected: true },
    { threshold: 0.2, expected: false },
  ])("includes clean passes in the denominator for mixed failures at cutoff $threshold", ({ threshold, expected }) => {
    const result = classify("FB", Array(9).fill("P"), { retryFailureThreshold: threshold, stabilizationPeriod: 10 });

    expect(result).toBe(expected);
  });

  it("applies strict threshold equality to a failure-only mixture", () => {
    const result = classify("FB", [], { retryFailureThreshold: 1 });

    expect(result).toBe(false);
  });

  it("uses all passed attempts rather than only the final one", () => {
    const result = classify("FPP", [], { retryFailureThreshold: 0.4 });

    expect(result).toBe(false);
  });

  it.each(["S", "U"])("leaves current %s status unassessed despite recovery history", (current) => {
    const result = classify(current, ["FP"]);

    expect(result).toBeUndefined();
  });

  it("disables current retry inference at depth minus one", () => {
    const result = classify("FP", ["FP"], { historyDepth: -1 });

    expect(result).toBeUndefined();
  });
});

describe("retry failure-rate window selection", () => {
  it.each([
    { options: {}, name: "omitted" },
    {
      options: { historyDepth: undefined, stabilizationPeriod: undefined, retryFailureThreshold: undefined },
      name: "undefined",
    },
  ])("uses all comparable history with $name defaults", ({ options }) => {
    const history = [...Array.from({ length: 10 }, (_, index) => (index % 2 === 0 ? "B" : "F")), "FP"];

    const result = classify("F", history, options);

    expect(result).toBe(true);
  });

  it.each([
    { depth: 3, expected: false },
    { depth: 0, expected: true },
  ])("selects a raw history slice at depth $depth", ({ depth, expected }) => {
    const result = classify("FP", ["P", "F", "P", "FFFF"], {
      historyDepth: depth,
      stabilizationPeriod: 2,
      retryFailureThreshold: 0.5,
    });

    expect(result).toBe(expected);
  });

  it("stops at the latest missing run", () => {
    const result = classify("P", [undefined, "FP"], { historyDepth: 0 });

    expect(result).toBe(false);
  });

  it("slices raw history before skipping duplicate current and ineligible results", () => {
    const { current, history } = makeInput("P", ["P", "S", "U", "FP"]);
    history[0]!.id = current.id;

    const result = getTestFlakiness(current, history, {
      algorithm: "retry-failure-rate",
      historyDepth: 3,
      stabilizationPeriod: 2,
    });

    expect(result).toBe(false);
  });

  it.each(["P", "FF", "BB", "PP"])("discards an identical uniform %s streak and older evidence", (current) => {
    const result = classify(current, [...Array(4).fill(current), "FBP"]);

    expect(result).toBeUndefined();
  });

  it.each(["FP", "FB", "FBP", "FFP", "FSP"])(
    "counts repeated mixed %s executions after a uniform stabilizing block",
    (current) => {
      const result = classify(current, [...Array(4).fill(current), ...Array(5).fill("P")]);

      expect(result).toBe(true);
    },
  );

  it("keeps mixed failure executions after a uniform stabilizing block", () => {
    const result = classify("P", [...Array(5).fill("FB"), ...Array(5).fill("P")], { retryFailureThreshold: 0.8 });

    expect(result).toBe(true);
  });

  it("uses the latest completed block as the evidence boundary", () => {
    const result = classify("F", ["P", "P", "P", "FP", "FP", "FP"], { stabilizationPeriod: 3 });

    expect(result).toBe(true);
  });

  it.each([
    { executions: 4, expected: true },
    { executions: 5, expected: undefined },
    { executions: 6, expected: undefined },
  ])("resets uniform failure evidence at $executions identical executions", ({ executions, expected }) => {
    const result = classify("FF", [...Array(executions - 1).fill("FF"), "P"]);

    expect(result).toBe(expected);
  });

  it.each([
    { current: "FF", expected: undefined },
    { current: "FP", expected: true },
  ])("applies a stabilization period of one only to uniform $current attempts", ({ current, expected }) => {
    const result = classify(current, [], { stabilizationPeriod: 1 });

    expect(result).toBe(expected);
  });

  it("breaks a uniform streak when the retry count differs", () => {
    const result = classify("FF", [...Array(4).fill("F"), ...Array(5).fill("P")]);

    expect(result).toBe(true);
  });

  it("does not use incomplete historical attempts for counts or stabilization", () => {
    const { current, history } = makeInput("P", ["P", "P", "P", "P", "P", "FP"]);
    history.slice(0, 5).forEach((result) => {
      delete result!.retries;
    });

    const result = getTestFlakiness(current, history, { algorithm: "retry-failure-rate" });

    expect(result).toBe(true);
  });

  it.each([
    { depth: 10, expected: false },
    { depth: 0, expected: true },
  ])("counts incomplete comparable executions toward the depth $depth limit", ({ depth, expected }) => {
    const { current, history } = makeInput("P", [...Array(10).fill("P"), "FP"]);
    history.slice(0, 10).forEach((result) => {
      delete result!.retries;
    });

    const result = getTestFlakiness(current, history, { algorithm: "retry-failure-rate", historyDepth: depth });

    expect(result).toBe(expected);
  });

  it("does not mutate current newest-first retries or chronological history", () => {
    const { current, history } = makeInput("FBP", ["FP", "P"]);
    const original = structuredClone({ current, history });
    Object.freeze(current.retries);
    history.forEach((result) => Object.freeze(result!.retries));
    Object.freeze(history);

    getTestFlakiness(current, history, { algorithm: "retry-failure-rate" });

    expect({ current, history }).toEqual(original);
  });
});
