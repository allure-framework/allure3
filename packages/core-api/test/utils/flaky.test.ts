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

describe("getTestFlakiness", () => {
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
