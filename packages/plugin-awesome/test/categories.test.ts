/* eslint-disable @typescript-eslint/unbound-method */
import type { CategoryDefinition } from "@allurereport/core-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";
import { describe, expect, it, vi } from "vitest";
import { applyCategoriesToTestResults, generateCategories } from "../src/categories.js";
import type { AwesomeDataWriter } from "../src/writer.js";

vi.mock("@allurereport/plugin-api", () => ({
  md5: (input: string) => `h(${input})`,
}));

vi.mock("@allurereport/core-api", () => {
  const EMPTY_VALUE = "<Empty>";

  const findLastByLabelName = (labels: any[] | undefined, name: string) => {
    if (!Array.isArray(labels)) {
      return undefined;
    }
    for (let index = labels.length - 1; index >= 0; index--) {
      const label = labels[index];
      if (label?.name === name) {
        return (label?.value ?? "") as string;
      }
    }
    return undefined;
  };

  const incrementStatistic = (stat: any) => {
    stat.total = (stat.total ?? 0) + 1;
  };

  const extractErrorMatchingData = (tr: any) => ({
    status: tr.status,
    labels: Array.isArray(tr.labels)
      ? tr.labels.map((label: any) => ({ name: label.name, value: label.value ?? "" }))
      : [],
    message: tr.error?.message,
    trace: tr.error?.trace,
    flaky: !!tr.flaky,
    duration: tr.duration,
  });

  const matchCategory = (categories: any[], data: any) => {
    for (const category of categories) {
      for (const matcher of category.matchers ?? []) {
        if (typeof matcher === "function") {
          if (matcher(data)) {
            return category;
          }
          continue;
        }

        if (matcher && typeof matcher === "object") {
          if (matcher.statuses && !matcher.statuses.includes(data.status)) {
            continue;
          }
          if (matcher.flaky !== undefined && matcher.flaky !== data.flaky) {
            continue;
          }
          if (matcher.message !== undefined) {
            const re = matcher.message instanceof RegExp ? matcher.message : new RegExp(String(matcher.message));
            if (!re.test(data.message ?? "")) {
              continue;
            }
          }
          if (matcher.trace !== undefined) {
            const re = matcher.trace instanceof RegExp ? matcher.trace : new RegExp(String(matcher.trace));
            if (!re.test(data.trace ?? "")) {
              continue;
            }
          }
          if (matcher.labels) {
            const entries = Object.entries(matcher.labels);
            let ok = true;
            for (const [labelName, expected] of entries) {
              const re = expected instanceof RegExp ? expected : new RegExp(String(expected));
              const values = (data.labels ?? [])
                .filter((label: any) => label.name === labelName)
                .map((label: any) => label.value ?? "");
              if (!values.some((value: string) => re.test(value))) {
                ok = false;
                break;
              }
            }
            if (!ok) {
              continue;
            }
          }
          return category;
        }
      }
    }
    return undefined;
  };

  const buildEnvironmentSortOrder = (environments: string[] = [], defaultEnvironment = "default") => {
    const orderMap = new Map<string, number>();
    let rank = 0;

    for (const env of environments) {
      if (env === defaultEnvironment) {
        continue;
      }
      orderMap.set(env, rank++);
    }

    orderMap.set(defaultEnvironment, Number.MAX_SAFE_INTEGER);
    return orderMap;
  };

  const compareChildNodes = (leftNodeId: string, rightNodeId: string, nodesById: any) => {
    const leftNode = nodesById[leftNodeId];
    const rightNode = nodesById[rightNodeId];

    const leftName = leftNode?.name ?? "";
    const rightName = rightNode?.name ?? "";

    const byName = leftName.localeCompare(rightName);
    if (byName !== 0) {
      return byName;
    }

    return String(leftNodeId).localeCompare(String(rightNodeId));
  };

  return {
    EMPTY_VALUE,
    extractErrorMatchingData,
    findLastByLabelName,
    incrementStatistic,
    matchCategory,
    buildEnvironmentSortOrder,
    compareChildNodes,
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

const mkCategory = (partial: Partial<CategoryDefinition> = {}): CategoryDefinition =>
  ({
    name: "Failed",
    matchers: [{ statuses: ["failed"] }],
    groupBy: [],
    groupByMessage: true,
    groupEnvironments: undefined,
    expand: false,
    hide: false,
    index: 0,
    ...partial,
  }) as unknown as CategoryDefinition;

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

    const categories: CategoryDefinition[] = [
      mkCategory({ name: "Broken", matchers: [{ statuses: ["broken"] }], index: 0 }),
      mkCategory({ name: "Failed", matchers: [{ statuses: ["failed"] }], index: 1 }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "a", name: "A", status: "failed" as any }),
      mkTest({ id: "b", name: "B", status: "broken" as any }),
      mkTest({ id: "c", name: "C", status: "passed" as any }),
      mkTest({ id: "h", name: "Hidden", hidden: true, status: "failed" as any }),
    ];

    await generateCategories(writer, {
      tests,
      categories,
      filename: "categories.json",
      environmentCount: 1,
      environments: ["prod"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 1,
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

    const categories: CategoryDefinition[] = [
      mkCategory({ name: "HiddenCat", hide: true, matchers: [{ statuses: ["failed"] }], index: 0 }),
      mkCategory({ name: "VisibleCat", hide: false, matchers: [{ statuses: ["broken"] }], index: 1 }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", status: "failed" as any }),
      mkTest({ id: "t2", status: "broken" as any }),
    ];

    await generateCategories(writer, {
      tests,
      categories,
      environmentCount: 1,
      environments: ["prod"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 1,
    });

    const store = written[0].data as any;

    expect(store.nodes["cat:h(HiddenCat)"]).toBeUndefined();
    expect(store.nodes["cat:h(VisibleCat)"]).toBeDefined();

    expect(store.nodes.t1).toBeUndefined();
    expect(store.nodes.t2).toBeDefined();

    expect(store.roots).toEqual(["cat:h(VisibleCat)"]);
  });

  it("should create group levels (built-ins + custom label) and message level; should keep leaf ids intact", async () => {
    const { writer, written } = mkWriter();

    const categories: CategoryDefinition[] = [
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
        transition: "regressed" as any,
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

    await generateCategories(writer, {
      tests,
      categories,
      environmentCount: 1,
      environments: ["prod"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 1,
    });

    const store = written[0].data as any;
    const categoryNodeId = "cat:h(Failed)";

    expect(store.nodes[categoryNodeId]).toBeDefined();

    expect(store.nodes.t1.type).toBe("tr");
    expect(store.nodes.t2.type).toBe("tr");

    const hasMessageBoom = Object.values(store.nodes).some(
      (node: any) => node.type === "message" && node.name === "boom",
    );
    expect(hasMessageBoom).toBe(true);

    const hasNoTransition = Object.values(store.nodes).some(
      (node: any) => node.type === "group" && node.key === "transition" && node.name === "transition: No transition",
    );
    expect(hasNoTransition).toBe(true);
  });

  it("should default groupEnvironments=true when environmentCount>1 and groupBy has no environment; history level is added; leaves are env-labelled", async () => {
    const { writer, written } = mkWriter();

    const categories: CategoryDefinition[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: [],
        groupByMessage: false,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", name: "Original", status: "failed" as any, environment: "prod", historyId: "H1" }),
      mkTest({ id: "t2", name: "Original", status: "failed" as any, environment: "staging", historyId: "H1" }),
      mkTest({ id: "t3", name: "Original", status: "failed" as any, environment: "   ", historyId: "H1" }),
    ];

    await generateCategories(writer, {
      tests,
      categories,
      environmentCount: 3,
      environments: ["staging", "prod", "default"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 3, // dropdown == All
    });

    const store = written[0].data as any;

    const historyNodes = Object.values(store.nodes).filter(
      (node: any) => node.type === "history" && node.key === "historyId",
    );
    expect(historyNodes.length).toBeGreaterThan(0);

    expect(store.nodes.t1.name).toBe("environment: prod");
    expect(store.nodes.t2.name).toBe("environment: staging");
    expect(store.nodes.t3.name).toBe("environment: No environment");
  });

  it("should ignore groupEnvironments when a single env is selected; no history level is added; leaf name stays original", async () => {
    const { writer, written } = mkWriter();

    const categories: CategoryDefinition[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: [],
        groupByMessage: false,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", name: "Original Name", status: "failed" as any, environment: "prod", historyId: "H1" }),
    ];

    await generateCategories(writer, {
      tests,
      categories,
      environmentCount: 3, // report has 3 env in total
      environments: ["prod", "staging", "default"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 1, // dropdown == one env -> grouping ignored
    });

    const store = written[0].data as any;

    const historyNodes = Object.values(store.nodes).filter(
      (node: any) => node.type === "history" && node.key === "historyId",
    );
    expect(historyNodes).toHaveLength(0);

    expect(store.nodes.t1.name).toBe("Original Name");
  });

  it("should default groupEnvironments=false when groupBy contains environment; environment is a regular group level", async () => {
    const { writer, written } = mkWriter();

    const categories: CategoryDefinition[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: ["environment"],
        groupByMessage: false,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", name: "Original Name", status: "failed" as any, environment: "prod", historyId: "H1" }),
    ];

    await generateCategories(writer, {
      tests,
      categories,
      environmentCount: 2,
      environments: ["prod", "default"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 2,
    });

    const store = written[0].data as any;

    const historyNodes = Object.values(store.nodes).filter(
      (node: any) => node.type === "history" && node.key === "historyId",
    );
    expect(historyNodes).toHaveLength(0);

    const envGroupNodes = Object.values(store.nodes).filter(
      (node: any) => node.type === "group" && node.key === "environment",
    );
    expect(envGroupNodes).toHaveLength(1);
    expect((envGroupNodes[0] as any).name).toBe("environment: prod");

    expect(store.nodes.t1.name).toBe("Original Name");
  });

  it("should respect groupEnvironments=false even when environmentCount>1", async () => {
    const { writer, written } = mkWriter();

    const categories: CategoryDefinition[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: [],
        groupByMessage: false,
        groupEnvironments: false,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", name: "Original Name", status: "failed" as any, environment: "prod", historyId: "H1" }),
    ];

    await generateCategories(writer, {
      tests,
      categories,
      environmentCount: 2,
      environments: ["prod", "default"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 2,
    });

    const store = written[0].data as any;

    const historyNodes = Object.values(store.nodes).filter(
      (node: any) => node.type === "history" && node.key === "historyId",
    );
    expect(historyNodes).toHaveLength(0);

    const envGroupNodes = Object.values(store.nodes).filter(
      (node: any) => node.type === "group" && node.key === "environment",
    );
    expect(envGroupNodes).toHaveLength(0);

    expect(store.nodes.t1.name).toBe("Original Name");
  });

  it("should group environments and render 'No environment' when groupEnvironments=true", async () => {
    const { writer, written } = mkWriter();

    const categories: CategoryDefinition[] = [
      mkCategory({
        name: "Failed",
        matchers: [{ statuses: ["failed"] }],
        groupBy: [],
        groupByMessage: false,
        groupEnvironments: true,
        index: 0,
      }),
    ];

    const tests: AwesomeTestResult[] = [
      mkTest({ id: "t1", name: "Original", status: "failed" as any, environment: "prod", historyId: "H1" }),
      mkTest({ id: "t2", name: "Original", status: "failed" as any, environment: "   ", historyId: "H1" }),
    ];

    await generateCategories(writer, {
      tests,
      categories,
      environmentCount: 2,
      environments: ["prod", "default"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 2,
    });

    const store = written[0].data as any;

    const historyNodes = Object.values(store.nodes).filter(
      (node: any) => node.type === "history" && node.key === "historyId",
    );
    expect(historyNodes.length).toBeGreaterThan(0);

    expect(store.nodes.t1.name).toBe("environment: prod");
    expect(store.nodes.t2.name).toBe("environment: No environment");
  });

  it("should render empty/blank message as 'No message' when groupByMessage=true", async () => {
    const { writer, written } = mkWriter();

    const categories: CategoryDefinition[] = [
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

    await generateCategories(writer, {
      tests,
      categories,
      environmentCount: 1,
      environments: ["prod"],
      defaultEnvironment: "default",
      selectedEnvironmentCount: 1,
    });

    const store = written[0].data as any;
    const messageNodes = Object.values(store.nodes).filter((node: any) => node.type === "message");

    expect(messageNodes).toHaveLength(1);
    expect((messageNodes[0] as any).name).toBe("No message");
  });
});
