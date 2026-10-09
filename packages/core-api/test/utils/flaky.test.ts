import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import type { HistoryTestResult, FlakinessOptions, TestResult, TestStatus } from "../../src/index.js";
import { getTestFlakiness } from "../../src/index.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("flakiness");
  await story("shared classification");
  await label("coverage", "flakiness");
});

const statuses: Record<string, TestStatus> = { P: "passed", F: "failed", B: "broken", S: "skipped", U: "unknown" };
const sequenceCase = (sequence: string): { current: TestResult; history: (HistoryTestResult | undefined)[] } => ({
  current: {
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
  },
  history: [...sequence.slice(0, -1)]
    .map((symbol, index) =>
      symbol === "-"
        ? undefined
        : {
            id: `history-${index}`,
            name: "test",
            status: statuses[symbol],
            url: "",
          },
    )
    .reverse(),
});

describe("Bayesian PFS", () => {
  it("classifies recovered failures while ignoring skipped and unknown attempts", () => {
    const { current, history } = sequenceCase("PP");
    current.retries = [
      { ...current, id: "retry", status: "broken" },
      { ...current, id: "skipped-retry", status: "skipped" },
    ];
    history[0]!.retries = ["failed", "unknown"];

    // Two failures and two passes give Beta(3, 21), with mean 0.125.
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.124 })).toBe(true);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.125 })).toBe(false);
  });

  it("accounts for bad states when classifying all-failing attempts", () => {
    const { current, history } = sequenceCase("FP");
    history[0]!.retries = ["failed"];

    // Beta(1, 20) times (1 + 2p²) has a mean between these cutoffs.
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.048 })).toBe(true);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.049 })).toBe(false);
  });

  it("does not treat consistently failing tests as highly flaky", () => {
    const { current, history } = sequenceCase("FF");

    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.05 })).toBe(true);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.06 })).toBe(false);
  });

  it("assesses legacy history without retries as single attempts", () => {
    const { current, history } = sequenceCase("PP");

    // Two passing attempts give mean 1 / 22.
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.045 })).toBe(true);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.046 })).toBe(false);
  });

  it("stops at a missing run while retaining newer evidence", () => {
    const { current, history } = sequenceCase("PP-PP");
    history[2]!.retries = ["failed", "failed", "failed"];

    expect(getTestFlakiness(current, history, { algorithm: "pfs", historyDepth: 0, pfsThreshold: 0.046 })).toBe(false);
  });

  it("ignores duplicate and ineligible results before applying history depth", () => {
    const { current, history } = sequenceCase("PP");
    history[0]!.retries = ["failed"];
    const entries = [
      { id: current.id, name: "duplicate", status: "passed" as const, url: "", retries: ["failed" as const] },
      { id: "skipped", name: "test", status: "skipped" as const, url: "" },
      { id: "unknown", name: "test", status: "unknown" as const, url: "" },
      ...history,
    ];

    expect(getTestFlakiness(current, entries, { algorithm: "pfs", historyDepth: 1, pfsThreshold: 0.086 })).toBe(true);
    expect(getTestFlakiness(current, entries, { algorithm: "pfs", historyDepth: 1, pfsThreshold: 0.087 })).toBe(false);
  });

  it("includes current retries without requiring a previous report", () => {
    const { current } = sequenceCase("P");
    current.retries = [
      { ...current, id: "retry-newer", status: "broken" },
      { ...current, id: "retry-older", status: "failed" },
    ];

    expect(getTestFlakiness(current, [], { algorithm: "pfs", pfsThreshold: 0.13 })).toBe(true);
    expect(getTestFlakiness(current, [], { algorithm: "pfs", pfsThreshold: 0.131 })).toBe(false);
  });

  it("compares complete attempt sequences without mutating inputs", () => {
    const { current, history } = sequenceCase("PPPP");
    history[0]!.retries = ["failed"];
    history[1]!.retries = ["broken"];
    history[2]!.retries = ["failed"];
    const snapshot = structuredClone({ current, history });
    history.forEach((entry) => Object.freeze(entry!.retries));
    Object.freeze(history);

    expect(getTestFlakiness(current, history, { algorithm: "pfs", stabilizationPeriod: 3, pfsThreshold: 0.148 })).toBe(
      true,
    );
    expect(getTestFlakiness(current, history, { algorithm: "pfs", stabilizationPeriod: 3, pfsThreshold: 0.149 })).toBe(
      false,
    );
    expect({ current, history }).toEqual(snapshot);
  });

  it("resets older evidence but retains the entire stabilizing retry streak", () => {
    const { current, history } = sequenceCase("PPPPPPP");
    current.retries = [{ ...current, id: "retry", status: "failed" }];
    history.slice(0, 4).forEach((entry) => {
      entry!.retries = ["failed"];
    });
    history[4]!.retries = ["broken", "broken", "broken"];

    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.19 })).toBe(true);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.2 })).toBe(false);
  });

  it.each([
    [1, true],
    [0, false],
  ] as const)("classifies bounded and unlimited history with depth %s as %s", (historyDepth, expected) => {
    const { current, history } = sequenceCase("PPP");

    expect(getTestFlakiness(current, history, { algorithm: "pfs", historyDepth, pfsThreshold: 0.044 })).toBe(expected);
  });

  it.each([
    ["P", {}],
    ["SP", {}],
    ["PP", { historyDepth: -1 }],
    ["PU", {}],
  ] as const)("leaves insufficient or disabled evidence unassessed for %s with %j", (sequence, options) => {
    const { current, history } = sequenceCase(sequence);

    expect(getTestFlakiness(current, history, { algorithm: "pfs", ...options })).toBeUndefined();
  });

  it("classifies repeated recovered failures with unlimited history", () => {
    const { current, history } = sequenceCase("P".repeat(400));
    current.retries = [{ ...current, id: "retry", status: "failed" }];
    history.forEach((entry) => {
      entry!.retries = ["failed"];
    });

    expect(
      getTestFlakiness(current, history, {
        algorithm: "pfs",
        historyDepth: 0,
        stabilizationPeriod: 500,
        pfsThreshold: 0.489,
      }),
    ).toBe(true);
    expect(
      getTestFlakiness(current, history, {
        algorithm: "pfs",
        historyDepth: 0,
        stabilizationPeriod: 500,
        pfsThreshold: 0.49,
      }),
    ).toBe(false);
  });

  it("classifies high retry counts using the integrated all-failing likelihood", () => {
    const { current, history } = sequenceCase("FP");
    current.retries = Array.from({ length: 1000 }, (_, index) => ({
      ...current,
      id: `retry-${index}`,
      status: "failed",
    }));
    history[0]!.retries = Array.from({ length: 199 }, () => "failed");

    // Independent Beta moments place the posterior mean at 0.9805757585882156.
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.98057575 })).toBe(true);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.98057577 })).toBe(false);
  });

  it("does not classify many all-failing runs as highly flaky", () => {
    const { current, history } = sequenceCase("F".repeat(400));

    expect(
      getTestFlakiness(current, history, {
        algorithm: "pfs",
        historyDepth: 0,
        stabilizationPeriod: 500,
        pfsThreshold: 0.05263,
      }),
    ).toBe(true);
    expect(
      getTestFlakiness(current, history, {
        algorithm: "pfs",
        historyDepth: 0,
        stabilizationPeriod: 500,
        pfsThreshold: 0.05264,
      }),
    ).toBe(false);
  });

  it("dispatches classification and requires PFS to strictly exceed the threshold", () => {
    const { current, history } = sequenceCase("PP");
    current.retries = [{ ...current, id: "retry", status: "failed" }];
    history[0]!.retries = ["failed"];

    expect(getTestFlakiness(current, history)).toBe(false);
    expect(getTestFlakiness(current, history, { algorithm: "status-changes", pfsThreshold: 0 })).toBe(false);
    expect(getTestFlakiness(current, history, { algorithm: "pfs" })).toBe(true);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0.125 })).toBe(false);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 0 })).toBe(true);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", pfsThreshold: 1 })).toBe(false);
    expect(getTestFlakiness(current, history, { algorithm: "pfs", historyDepth: -1 })).toBeUndefined();
  });
});

describe("Status Changes", () => {
  const cases: [string, boolean | undefined][] = [
    ["P", undefined],
    ["F", undefined],
    ["B", undefined],
    ["S", undefined],
    ["U", undefined],
    ["PP", false],
    ["FF", false],
    ["BB", false],
    ["PF", false],
    ["PB", false],
    ["FP", false],
    ["FB", false],
    ["BP", false],
    ["BF", false],
    ["PFP", false],
    ["PBP", false],
    ["PFFP", false],
    ["PBBP", false],
    ["FPF", true],
    ["BPB", true],
    ["FBF", true],
    ["BFB", true],
    ["PFB", true],
    ["PBF", true],
    ["FPB", true],
    ["FBP", true],
    ["BPF", true],
    ["BFP", true],
    ["PFPF", true],
    ["PFBP", true],
    ["PFPFP", true],
    ["PFPFPPPPP", false],
    ["FFFFFPF", true],
    ["FBF-P", undefined],
    ["FBF-PF", false],
    ["FBF-FBF", true],
    ["FBF-PF-P", undefined],
  ];
  it.each(cases)("classifies %s as %s", (sequence, expected) => {
    const { current, history } = sequenceCase(sequence);

    const result = getTestFlakiness(current, history);

    expect(result).toBe(expected);
  });

  const windows: [string, FlakinessOptions | undefined, boolean | undefined][] = [
    ["FPPPPFFFPPPP", undefined, false],
    ["FPPPPFFFPPPP", { historyDepth: 10 }, false],
    ["FPPPPFFFPPPP", { historyDepth: 11 }, true],
    ["FPPPPFFFPPPP", { historyDepth: 0 }, true],
    ["FBF-P", { historyDepth: 0 }, undefined],
    ["FBF", { historyDepth: -1 }, undefined],
    ["FBF", { historyDepth: 1 }, false],
    ["FBF", { historyDepth: 2 }, true],
    ["FBF", { stabilizationPeriod: 1 }, false],
    ["FBF", { stabilizationPeriod: 3 }, true],
    ["FBF", { stabilizationPeriod: 4, historyDepth: 2 }, true],
    ["FFF", { stabilizationPeriod: 4, historyDepth: 2 }, false],
    ["PFPFPP", { stabilizationPeriod: 3 }, true],
    ["PFPFPPP", { stabilizationPeriod: 3 }, false],
    ["FBFFFBF", { stabilizationPeriod: 3 }, true],
    ["P-PFBF", { historyDepth: 2 }, true],
  ];
  it.each(windows)("classifies %s with %j as %s", (sequence, options, expected) => {
    const { current, history } = sequenceCase(sequence);

    const result = getTestFlakiness(current, history, options);

    expect(result).toBe(expected);
  });

  it("ignores resolved noncomparable results before applying the limit without mutating inputs", () => {
    const { current, history } = sequenceCase("FBF");
    const entries = [
      { id: current.id, name: "duplicate", status: "passed" as const, url: "" },
      { id: "skipped", name: "skipped", status: "skipped" as const, url: "" },
      { id: "unknown", name: "unknown", status: "unknown" as const, url: "" },
      ...history,
    ];
    const snapshot = structuredClone({ current, entries });
    Object.freeze(current);
    entries.forEach((entry) => Object.freeze(entry));
    Object.freeze(entries);

    const result = getTestFlakiness(current, entries, { historyDepth: 2 });

    expect(result).toBe(true);
    expect({ current, entries }).toEqual(snapshot);
  });
  it.each(["skipped", "unknown"] as const)("leaves only noncomparable %s history unassessed", (status) => {
    const { current } = sequenceCase("F");
    const history = [{ id: "history", name: "test", status, url: "" }];

    const result = getTestFlakiness(current, history);

    expect(result).toBeUndefined();
  });
  it("keeps metadata overrides outside history classification", () => {
    const { current, history } = sequenceCase("PP");
    current.flaky = true;
    current.sourceMetadata.reportedFlaky = true;

    const result = getTestFlakiness(current, history);

    expect(result).toBe(false);
  });
});
