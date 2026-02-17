import { describe, expect, it } from "vitest";
import {
  DEFAULT_ERROR_CATEGORIES,
  extractErrorMatchingData,
  matchCategory,
  matchCategoryMatcher,
  normalizeErrorCategoriesConfig,
} from "../../src/index.js";
import type { ErrorCategoriesConfig } from "../../src/index.js";
import type { TestLabel } from "../../src/metadata.js";
import type { TestResult, TestStatus } from "../../src/model.js";

const mkLabel = (name: string, value?: string): TestLabel => ({ name, value: value ?? "" });

const mkData = (overrides?: Partial<ReturnType<typeof extractErrorMatchingData>>) => {
  const base = {
    status: "failed" as TestStatus,
    labels: [mkLabel("owner", "alice"), mkLabel("layer", "ui")],
    message: "boom",
    trace: "stack",
    flaky: false,
    duration: 123,
  };
  return { ...base, ...overrides };
};

describe("normalizeErrorCategoriesConfig", () => {
  it("returns only defaults when cfg is undefined", () => {
    const normalized = normalizeErrorCategoriesConfig(undefined);
    expect(normalized.map((r) => r.name)).toEqual(DEFAULT_ERROR_CATEGORIES.map((r) => r.name));
    expect(normalized).toHaveLength(DEFAULT_ERROR_CATEGORIES.length);
  });

  it("accepts array config and appends defaults after custom rules", () => {
    const cfg: ErrorCategoriesConfig = [
      { name: "Custom", matchers: { statuses: ["failed"] } },
      { name: "Another", matchers: { statuses: ["broken"] } },
    ];

    const normalized = normalizeErrorCategoriesConfig(cfg);
    expect(normalized.map((r) => r.name)).toEqual([
      "Custom",
      "Another",
      ...DEFAULT_ERROR_CATEGORIES.map((r) => r.name),
    ]);

    expect(normalized[0].index).toBe(0);
    expect(normalized[1].index).toBe(1);
    expect(normalized[2].index).toBe(2);
  });

  it("accepts object config with { rules }", () => {
    const cfg: ErrorCategoriesConfig = {
      rules: [{ name: "Custom", matchers: { statuses: ["failed"] } }],
    };
    const normalized = normalizeErrorCategoriesConfig(cfg);
    expect(normalized[0].name).toBe("Custom");
  });

  it("merges rules with the same name by concatenating matchers", () => {
    const cfg: ErrorCategoriesConfig = [
      { name: "Same", matchers: { statuses: ["failed"] } },
      { name: "Same", matchers: { statuses: ["broken"] } },
    ];
    const normalized = normalizeErrorCategoriesConfig(cfg);
    const same = normalized.find((r) => r.name === "Same")!;
    expect(same.matchers).toHaveLength(2);
  });

  it("throws when rule is not an object", () => {
    const cfg = [null as any] satisfies any;
    expect(() => normalizeErrorCategoriesConfig(cfg)).toThrow(/must be an object/);
  });

  it("throws when name is empty", () => {
    const cfg: ErrorCategoriesConfig = [{ name: "   ", matchers: { statuses: ["failed"] } }];
    expect(() => normalizeErrorCategoriesConfig(cfg)).toThrow(/name must be non-empty string/);
  });

  it("throws when matchers missing", () => {
    const cfg: ErrorCategoriesConfig = [{ name: "X" } as any];
    expect(() => normalizeErrorCategoriesConfig(cfg)).toThrow(/must define matchers/);
  });

  it("throws when canonical keys are mixed with compatibility keys", () => {
    const cfg: ErrorCategoriesConfig = [
      {
        name: "X",
        matchers: { statuses: ["failed"] },
        messageRegex: "boom",
      },
    ];
    expect(() => normalizeErrorCategoriesConfig(cfg)).toThrow(/mixes canonical keys with compatibility keys/);
  });

  it("builds matcher from compatibility keys", () => {
    const cfg: ErrorCategoriesConfig = [
      { name: "Compat", matchedStatuses: ["failed"], messageRegex: "boom", flaky: false },
    ];
    const normalized = normalizeErrorCategoriesConfig(cfg);
    const compat = normalized.find((r) => r.name === "Compat")!;
    expect(compat.matchers).toHaveLength(1);
    expect(typeof compat.matchers[0]).toBe("object");
  });

  it("throws when matchers contains invalid types", () => {
    const cfg: ErrorCategoriesConfig = [{ name: "X", matchers: [123 as any] as any }];
    expect(() => normalizeErrorCategoriesConfig(cfg)).toThrow(/must be object\|function/);
  });

  it("validates groupBy selectors: accepts built-ins and { label }", () => {
    const cfg: ErrorCategoriesConfig = [
      {
        name: "X",
        matchers: { statuses: ["failed"] },
        groupBy: ["flaky", "owner", "severity", "transition", { label: "myLabel" } as any],
      },
    ];
    const normalized = normalizeErrorCategoriesConfig(cfg);
    const x = normalized.find((r) => r.name === "X")!;
    expect(x.groupBy).toHaveLength(5);
  });

  it("accepts groupBy selector 'status' (built-in)", () => {
    const cfg: ErrorCategoriesConfig = [{ name: "X", matchers: { statuses: ["failed"] }, groupBy: ["status"] as any }];
    const normalized = normalizeErrorCategoriesConfig(cfg);
    expect(normalized.find((rule) => rule.name === "X")!.groupBy).toEqual(["status"]);
  });

  describe("new config fields", () => {
    it("accepts groupEnvironments boolean and keeps it undefined by default", () => {
      const cfg: ErrorCategoriesConfig = [
        { name: "X", matchers: { statuses: ["failed"] }, groupEnvironments: true },
        { name: "Y", matchers: { statuses: ["failed"] } },
      ];

      const normalized = normalizeErrorCategoriesConfig(cfg);
      const x = normalized.find((r) => r.name === "X") as any;
      const y = normalized.find((r) => r.name === "Y") as any;

      expect(x.groupEnvironments).toBe(true);
      expect(y.groupEnvironments).toBeUndefined();
    });

    it("accepts groupBy selector 'environment' (built-in) for new spec", () => {
      const cfg: ErrorCategoriesConfig = [
        { name: "X", matchers: { statuses: ["failed"] }, groupBy: ["environment"] as any },
      ];
      const normalized = normalizeErrorCategoriesConfig(cfg);
      const x = normalized.find((r) => r.name === "X")!;
      expect(x.groupBy).toEqual(["environment"]);
    });

    it("accepts groupBy selector 'status'", () => {
      const cfg: ErrorCategoriesConfig = [
        { name: "X", matchers: { statuses: ["failed"] }, groupBy: ["status"] as any },
      ];
      const normalized = normalizeErrorCategoriesConfig(cfg);
      const x = normalized.find((r) => r.name === "X")!;
      expect(x.groupBy).toEqual(["status"]);
    });

    it("accepts groupBy selector 'layer'", () => {
      const cfg: ErrorCategoriesConfig = [{ name: "X", matchers: { statuses: ["failed"] }, groupBy: ["layer"] as any }];
      const normalized = normalizeErrorCategoriesConfig(cfg);
      const x = normalized.find((r) => r.name === "X")!;
      expect(x.groupBy).toEqual(["layer"]);
    });

    it("still accepts custom { label } selector", () => {
      const cfg: ErrorCategoriesConfig = [
        { name: "X", matchers: { statuses: ["failed"] }, groupBy: [{ label: "component" } as any] },
      ];
      const normalized = normalizeErrorCategoriesConfig(cfg);
      const x = normalized.find((r) => r.name === "X")!;
      expect(x.groupBy).toHaveLength(1);
    });

    it("rejects invalid groupBy selectors: object without label and unknown strings", () => {
      const cfg1: ErrorCategoriesConfig = [
        { name: "X", matchers: { statuses: ["failed"] }, groupBy: [{ nope: "x" } as any] },
      ];
      expect(() => normalizeErrorCategoriesConfig(cfg1)).toThrow(/groupBy contains invalid selector/);

      const cfg2: ErrorCategoriesConfig = [
        { name: "X", matchers: { statuses: ["failed"] }, groupBy: ["not-a-built-in" as any] },
      ];
      expect(() => normalizeErrorCategoriesConfig(cfg2)).toThrow(/groupBy contains invalid selector/);
    });
  });
});

describe("matchCategoryMatcher / matchCategory", () => {
  it("matches function matcher", () => {
    const fn = (d: any) => d.status === "failed";
    expect(matchCategoryMatcher(fn, mkData({ status: "failed" as TestStatus }))).toBe(true);
    expect(matchCategoryMatcher(fn, mkData({ status: "broken" as TestStatus }))).toBe(false);
  });

  it("matches object matcher by status + flaky", () => {
    expect(
      matchCategoryMatcher({ statuses: ["failed"], flaky: false }, mkData({ status: "failed", flaky: false })),
    ).toBe(true);
    expect(
      matchCategoryMatcher({ statuses: ["failed"], flaky: false }, mkData({ status: "failed", flaky: true })),
    ).toBe(false);
  });

  it("matches labels with string or RegExp expected", () => {
    const d = mkData({ labels: [mkLabel("owner", "alice"), mkLabel("owner", "bob")] });
    expect(matchCategoryMatcher({ labels: { owner: "ali" } }, d)).toBe(true);
    expect(matchCategoryMatcher({ labels: { owner: /^bob$/ } }, d)).toBe(true);
    expect(matchCategoryMatcher({ labels: { owner: /^carol$/ } }, d)).toBe(false);
  });

  it("matches message + trace", () => {
    const d = mkData({ message: "TypeError: x", trace: "at file.ts:10" });
    expect(matchCategoryMatcher({ message: "TypeError" }, d)).toBe(true);
    expect(matchCategoryMatcher({ trace: /file\.ts/ }, d)).toBe(true);
    expect(matchCategoryMatcher({ message: /ReferenceError/ }, d)).toBe(false);
  });

  it("matchCategory returns first matching category in order", () => {
    const cats = normalizeErrorCategoriesConfig([
      { name: "First", matchers: { statuses: ["failed"] } },
      { name: "Second", matchers: { statuses: ["failed"] } },
    ]);

    const m = matchCategory(cats, mkData({ status: "failed" }));
    expect(m?.name).toBe("First");
  });

  it("matchCategory returns undefined when no matchers match", () => {
    const cats = normalizeErrorCategoriesConfig([{ name: "OnlyBroken", matchers: { statuses: ["broken"] } }]);
    const m = matchCategory(cats, mkData({ status: "unknown" }));
    expect(m).toBeUndefined();
  });
});

describe("extractErrorMatchingData", () => {
  it("extracts message/trace from tr.error, normalizes labels values to string", () => {
    const tr = {
      status: "failed",
      flaky: false,
      duration: 50,
      labels: [
        { name: "owner", value: undefined },
        { name: "severity", value: "critical" },
      ],
      error: { message: "boom", trace: "stack" },
    } satisfies Pick<TestResult, "status" | "labels" | "error" | "flaky" | "duration">;

    const d = extractErrorMatchingData(tr);
    expect(d.status).toBe("failed");
    expect(d.flaky).toBe(false);
    expect(d.duration).toBe(50);
    expect(d.message).toBe("boom");
    expect(d.trace).toBe("stack");
    expect(d.labels).toEqual([mkLabel("owner", ""), mkLabel("severity", "critical")]);
  });

  it("handles missing labels and missing error", () => {
    const tr = {
      status: "broken",
      flaky: true,
      duration: undefined,
      labels: undefined,
      error: undefined,
    } as any;

    const d = extractErrorMatchingData(tr);
    expect(d.labels).toEqual([]);
    expect(d.message).toBeUndefined();
    expect(d.trace).toBeUndefined();
  });
});
