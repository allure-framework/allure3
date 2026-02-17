/* eslint-disable @typescript-eslint/unbound-method */
import type { ErrorCategoryNorm } from "@allurereport/core-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";
import { describe, expect, it, vi } from "vitest";
import { applyCategoriesToTestResults, generateCategories } from "../src/errorCategories.js";
import type { AwesomeDataWriter } from "../src/writer.js";

vi.mock("@allurereport/plugin-api", () => ({
  md5: (s: string) => `h(${s})`,
}));

vi.mock("@allurereport/core-api", () => {
  const findLastByLabelName = (labels: any[] | undefined, name: string) => {
    if (!Array.isArray(labels)) {
      return undefined;
    }
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i];
      if (l?.name === name) {
        return (l?.value ?? "") as string;
      }
    }
    return undefined;
  };

  const incrementStatistic = (stat: any) => {
    stat.total = (stat.total ?? 0) + 1;
  };

  const extractErrorMatchingData = (tr: any) => ({
    status: tr.status,
    labels: Array.isArray(tr.labels) ? tr.labels.map((l: any) => ({ name: l.name, value: l.value ?? "" })) : [],
    message: tr.error?.message,
    trace: tr.error?.trace,
    flaky: !!tr.flaky,
    duration: tr.duration,
  });

  // match first category whose matcher returns true
  const matchCategory = (categories: any[], d: any) => {
    for (const c of categories) {
      for (const m of c.matchers ?? []) {
        if (typeof m === "function") {
          if (m(d)) {
            return c;
          }
          continue;
        }
        if (m && typeof m === "object") {
          if (m.statuses && !m.statuses.includes(d.status)) {
            continue;
          }
          if (m.flaky !== undefined && m.flaky !== d.flaky) {
            continue;
          }
          if (m.message !== undefined) {
            const re = m.message instanceof RegExp ? m.message : new RegExp(String(m.message));
            if (!re.test(d.message ?? "")) {
              continue;
            }
          }
          if (m.trace !== undefined) {
            const re = m.trace instanceof RegExp ? m.trace : new RegExp(String(m.trace));
            if (!re.test(d.trace ?? "")) {
              continue;
            }
          }
          if (m.labels) {
            const entries = Object.entries(m.labels);
            let ok = true;
            for (const [labelName, expected] of entries) {
              const re = expected instanceof RegExp ? expected : new RegExp(String(expected));
              const values = (d.labels ?? []).filter((l: any) => l.name === labelName).map((l: any) => l.value ?? "");
              if (!values.some((v: string) => re.test(v))) {
                ok = false;
                break;
              }
            }
            if (!ok) {
              continue;
            }
          }
          return c;
        }
      }
    }
    return undefined;
  };

  return {
    extractErrorMatchingData,
    findLastByLabelName,
    incrementStatistic,
    matchCategory,
  };
});

type WriterWidget = { fileName: string; data: unknown };

const mkWriter = () => {
  const written: WriterWidget[] = [];
  const writer: AwesomeDataWriter = {
    writeData: vi.fn().mockResolvedValue(undefined),
    writeWidget: vi.fn(async (fileName: string, data: unknown) => {
      written.push({ fileName, data });
    }),
    writeTestCase: vi.fn().mockResolvedValue(undefined),
    writeAttachment: vi.fn().mockResolvedValue(undefined),
  } as unknown as AwesomeDataWriter;
  return { writer, written };
};

const mkCategory = (partial: Partial<ErrorCategoryNorm> = {}): ErrorCategoryNorm =>
  ({
    name: "Failed",
    matchers: [{ statuses: ["failed"] }],
    groupBy: [],
    groupByMessage: true,
    groupByEnvironment: undefined,
    groupByHistoryId: false,
    expand: false,
    hide: false,
    index: 0,
    ...partial,
  }) as unknown as ErrorCategoryNorm;

const mkTest = (partial: Partial<AwesomeTestResult> = {}): AwesomeTestResult =>
  ({
    id: "t1",
    name: "Test 1",
    status: "failed",
    labels: [],
    flaky: false,
    hidden: false,
    duration: 10,
    retriesCount: 0,
    transition: undefined,
    tooltips: undefined,
    environment: "prod",
    historyId: undefined,
    error: { message: "boom", trace: "stack" },
    groupedLabels: {},
    ...partial,
  }) as unknown as AwesomeTestResult;

describe("applyCategoriesToTestResults", () => {
  it("should set empty categories when no category matched", () => {
    const tests = [mkTest({ status: "passed" as any })];
    const categories = [mkCategory({ name: "Failures", matchers: [{ statuses: ["failed"] }] })];

    applyCategoriesToTestResults(tests, categories);

    expect(tests[0].categories).toEqual([]);
  });

  it("should attach matched category name to test result", () => {
    const tests = [mkTest({ status: "failed" as any })];
    const categories = [mkCategory({ name: "Failures", matchers: [{ statuses: ["failed"] }] })];

    applyCategoriesToTestResults(tests, categories);

    expect(tests[0].categories).toEqual([{ name: "Failures" }]);
  });
});

describe("generateCategories", () => {
  it("should write categories.json store with roots ordered by config and only touched categories", async () => {
    const { writer, written } = mkWriter();

    const categories: ErrorCategoryNorm[] = [
      mkCategory({ name: "Broken", matchers: [{ statuses: ["broken"] }], index: 0 }),
      mkCategory({ name: "Failed", matchers: [{ statuses: ["failed"] }], index: 1 }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "a", name: "A", status: "failed" as any }),
      mkTest({ id: "b", name: "B", status: "broken" as any }),
      mkTest({ id: "c", name: "C", status: "passed" as any }), // unmatched -> ignored
      mkTest({ id: "h", name: "Hidden", hidden: true, status: "failed" as any }), // hidden -> ignored
    ];

    await generateCategories(writer, {
      tests,
      categories,
      filename: "categories.json",
      environmentCount: 1,
    });

    expect(writer.writeWidget).toHaveBeenCalledWith("categories.json", expect.any(Object));
    const store = written.find((w) => w.fileName === "categories.json")!.data as any;

    expect(store.roots).toEqual(["cat:h(Broken)", "cat:h(Failed)"]);

    expect(store.nodes["cat:h(Broken)"].type).toBe("category");
    expect(store.nodes["cat:h(Failed)"].type).toBe("category");

    expect(store.nodes.a.type).toBe("tr");
    expect(store.nodes.b.type).toBe("tr");
    expect(store.nodes.c).toBeUndefined();
    expect(store.nodes.h).toBeUndefined();
  });

  it("should skip hidden categories (hide=true) even when matched", async () => {
    const { writer, written } = mkWriter();

    const categories: ErrorCategoryNorm[] = [
      mkCategory({ name: "HiddenCat", hide: true, matchers: [{ statuses: ["failed"] }], index: 0 }),
      mkCategory({ name: "VisibleCat", hide: false, matchers: [{ statuses: ["broken"] }], index: 1 }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", status: "failed" as any }),
      mkTest({ id: "t2", status: "broken" as any }),
    ];

    await generateCategories(writer, { tests, categories, environmentCount: 1 });

    const store = written[0].data as any;

    expect(store.nodes["cat:h(HiddenCat)"]).toBeUndefined();
    expect(store.nodes["cat:h(VisibleCat)"]).toBeDefined();

    expect(store.nodes.t1).toBeUndefined();
    expect(store.nodes.t2).toBeDefined();

    expect(store.roots).toEqual(["cat:h(VisibleCat)"]);
  });

  it("should create group levels (built-ins + custom label) and message level; should sort children by name then id", async () => {
    const { writer, written } = mkWriter();

    const categories: ErrorCategoryNorm[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: ["flaky", "owner", "severity", "transition", { label: "layer" } as any],
        groupByMessage: true,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({
        id: "t1",
        name: "Leaf B",
        status: "failed" as any,
        flaky: true,
        transition: "failed->passed" as any,
        labels: [
          { name: "owner", value: "alice" } as any,
          { name: "severity", value: "critical" } as any,
          { name: "layer", value: "ui" } as any,
        ],
        error: { message: "boom", trace: "" } as any,
      }),
      mkTest({
        id: "t2",
        name: "Leaf A",
        status: "failed" as any,
        flaky: false,
        transition: undefined,
        labels: [{ name: "owner", value: "bob" } as any, { name: "layer", value: "api" } as any],
        error: { message: "boom", trace: "" } as any,
      }),
    ];

    await generateCategories(writer, { tests, categories, environmentCount: 1 });

    const store = written[0].data as any;
    const catId = "cat:h(Failed)";

    expect(store.nodes[catId]).toBeDefined();
    expect(store.nodes.t1.type).toBe("tr");
    expect(store.nodes.t2.type).toBe("tr");

    const catChildren: string[] = store.nodes[catId].childrenIds ?? [];
    const names = catChildren.map((id) => store.nodes[id].name);

    // verify sorted by name (then id) property indirectly: names are non-decreasing
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);

    // message node name: "boom" (no "message:" prefix)
    const hasMessageBoom = Object.values(store.nodes).some((n: any) => n.type === "message" && n.name === "boom");
    expect(hasMessageBoom).toBe(true);

    // transition empty -> "No transition"
    const hasNoTransition = Object.values(store.nodes).some(
      (n: any) => n.type === "group" && n.name === "transition: No transition",
    );
    expect(hasNoTransition).toBe(true);

    // severity missing -> fallback "normal"
    const hasSeverityNormal = Object.values(store.nodes).some(
      (n: any) => n.type === "group" && n.name === "severity: normal",
    );
    expect(hasSeverityNormal).toBe(true);
  });

  it("should add environment grouping when environmentCount>1 and groupByHistoryId=false; should format empty environment as 'No environment'", async () => {
    const { writer, written } = mkWriter();

    const categories: ErrorCategoryNorm[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: [],
        groupByMessage: false,
        groupByHistoryId: false,
        groupByEnvironment: undefined,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", status: "failed" as any, environment: "prod" }),
      mkTest({ id: "t2", status: "failed" as any, environment: "   " }),
    ];

    await generateCategories(writer, { tests, categories, environmentCount: 2 });

    const store = written[0].data as any;
    const envNodes = Object.values(store.nodes).filter((n: any) => n.type === "group" && n.key === "environment");
    const envNames = envNodes.map((n: any) => n.name).sort((a: string, b: string) => a.localeCompare(b));

    expect(envNames).toContain("environment: prod");
    expect(envNames).toContain("environment: No environment");
  });

  it("should not add environment group level when groupByHistoryId=true; leaf name becomes 'environment: X' when envGrouping is active", async () => {
    const { writer, written } = mkWriter();

    const categories: ErrorCategoryNorm[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: [],
        groupByMessage: false,
        groupByHistoryId: true,
        groupByEnvironment: undefined,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({
        id: "t1",
        name: "Original Name",
        status: "failed" as any,
        environment: "prod",
        historyId: "H1",
      }),
    ];

    await generateCategories(writer, { tests, categories, environmentCount: 2 });

    const store = written[0].data as any;

    const envGroupNodes = Object.values(store.nodes).filter((n: any) => n.type === "group" && n.key === "environment");
    expect(envGroupNodes).toHaveLength(0);

    expect(store.nodes.t1.name).toBe("environment: prod");

    const historyNodes = Object.values(store.nodes).filter((n: any) => n.type === "history" && n.key === "historyId");
    expect(historyNodes).toHaveLength(1);
    expect((historyNodes[0] as any).value).toBe("H1");
  });

  it("should render empty/blank message as 'No message' when groupByMessage=true", async () => {
    const { writer, written } = mkWriter();

    const categories: ErrorCategoryNorm[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: [],
        groupByMessage: true,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", status: "failed" as any, error: { message: "   ", trace: "" } as any }),
    ];

    await generateCategories(writer, { tests, categories, environmentCount: 1 });

    const store = written[0].data as any;
    const messageNodes = Object.values(store.nodes).filter((n: any) => n.type === "message");

    expect(messageNodes).toHaveLength(1);
    expect((messageNodes[0] as any).name).toBe("No message");
  });
});
