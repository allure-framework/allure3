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
    ["FPPPPFFFPPPP", undefined, true],
    ["FPPPPFFFPPPP", { historyDepth: undefined, stabilizationPeriod: undefined }, true],
    ["FPPPPFFFPPPP", { historyDepth: 10 }, false],
    ["FPPPPFFFPPPP", { historyDepth: 11 }, true],
    ["FPPPPFFFPPPP", { historyDepth: 0 }, true],
    ["FBF-P", { historyDepth: 0 }, undefined],
    ["FBF", { historyDepth: -1 }, undefined],
    ["FBF", { historyDepth: 3, stabilizationPeriod: 2 }, true],
    ["FBF", { stabilizationPeriod: 1 }, false],
    ["FBF", { stabilizationPeriod: 3 }, true],
    ["FBFFFBF", { stabilizationPeriod: 3, historyDepth: 4 }, true],
    ["PFPFPP", { stabilizationPeriod: 3 }, true],
    ["PFPFPPP", { stabilizationPeriod: 3 }, false],
    ["FBFFFBF", { stabilizationPeriod: 3 }, true],
    ["P-PFBF", { historyDepth: 4, stabilizationPeriod: 3 }, true],
  ];
  it.each(windows)("classifies %s with %j as %s", (sequence, options, expected) => {
    const { current, history } = sequenceCase(sequence);

    const result = getTestFlakiness(current, history, options);

    expect(result).toBe(expected);
  });

  it.each(["status-changes", "retry-failure-rate"] as const)(
    "slices raw history before filtering for %s without mutating inputs",
    (algorithm) => {
      const { current, history } = sequenceCase("FBP");
      const entries = [
        { id: current.id, name: "duplicate", status: "passed" as const, url: "" },
        { id: "skipped", name: "skipped", status: "skipped" as const, url: "" },
        { id: "unknown", name: "unknown", status: "unknown" as const, url: "" },
        ...history,
      ].map((result) => ({ ...result, retries: [] }));
      const snapshot = structuredClone({ current, entries });
      Object.freeze(current);
      entries.forEach((entry) => Object.freeze(entry));
      Object.freeze(entries);

      const result = getTestFlakiness(current, entries, { algorithm, historyDepth: 3, stabilizationPeriod: 2 });

      expect(result).toBe(algorithm === "status-changes" ? undefined : false);
      expect({ current, entries }).toEqual(snapshot);
    },
  );
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
