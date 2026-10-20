import { epic, feature, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import type { Allure2Status, Allure2TestResult } from "../src/model.js";
import { byLabels, createTree, createWidget } from "../src/tree.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-allure2");
  await story("deterministic-tree-widgets");
});

const result = (uid: string, suite: string, start?: number, status: Allure2Status = "failed"): Allure2TestResult => ({
  uid,
  name: uid,
  status,
  time: start === undefined ? {} : { start },
  retryHash: null,
  flaky: false,
  newFailed: false,
  newBroken: false,
  newPassed: false,
  retriesCount: 0,
  retriesStatusChange: false,
  beforeStages: [],
  testStage: null,
  afterStages: [],
  labels: [{ name: "suite", value: suite }],
  parameters: [],
  links: [],
  isRetry: false,
  retry: false,
  extra: {},
});

const widget = (tests: Allure2TestResult[]) => createWidget(createTree(tests, byLabels(["suite"])));

describe("tree widget ordering", () => {
  it("keeps equal-statistic suites chronological regardless of ingestion order", () => {
    const earlier = result("z-earlier", "ScreenDiffDemoTest", 8000);
    const later = result("a-later", "HtmlTagsStatusDetailsTest", 240000);
    const input = [later, earlier];
    const expected = ["ScreenDiffDemoTest", "HtmlTagsStatusDetailsTest"];

    expect(widget(input).items.map(({ name }) => name)).toEqual(expected);
    expect(widget([earlier, later]).items.map(({ name }) => name)).toEqual(expected);
    expect(input).toEqual([later, earlier]);
  });

  it("orders leaves with equal start times by stable UID", () => {
    const first = result("Z", "suite", 1000);
    const last = result("a", "suite", 1000);
    const tree = createTree([last, first], byLabels(["suite"]));

    expect(tree.children).toMatchObject([{ children: [{ uid: "Z" }, { uid: "a" }] }]);
    expect(createTree([first, last], byLabels(["suite"]))).toEqual(tree);
  });

  it("places missing start times first and treats zero as a real timestamp", () => {
    const missingZ = result("z", "missing-z");
    missingZ.time = { start: undefined };
    const missingA = result("a", "missing-a");
    const zero = result("0", "zero", 0);
    const later = result("1", "later", 1000);
    const input = [later, missingZ, zero, missingA];

    expect(widget(input).items.map(({ name }) => name)).toEqual(["missing-a", "missing-z", "zero", "later"]);
    expect(widget([...input].reverse())).toEqual(widget(input));
  });

  it("keeps absent start keys ordered consistently across every ingestion permutation", () => {
    const missing = result("m", "missing");
    const earlier = result("z", "earlier", 1);
    const later = result("a", "later", 2);
    const orders = [
      [missing, earlier, later],
      [missing, later, earlier],
      [earlier, missing, later],
      [earlier, later, missing],
      [later, missing, earlier],
      [later, earlier, missing],
    ];

    expect(missing.time).not.toHaveProperty("start");
    for (const tests of orders) {
      expect(widget(tests).items.map(({ name }) => name)).toEqual(["missing", "earlier", "later"]);
    }
  });

  it("preserves statistic priority over chronological ordering", () => {
    const items = widget([
      result("passed", "passed", 0, "passed"),
      result("broken", "broken", 1000, "broken"),
      result("failed", "failed", 2000, "failed"),
    ]).items;

    expect(items.map(({ name }) => name)).toEqual(["failed", "broken", "passed"]);
    expect(items.map(({ statistic }) => statistic.total)).toEqual([1, 1, 1]);
  });

  it("selects the same ten groups when equal-statistic results arrive in reverse", () => {
    const tests = Array.from({ length: 12 }, (_, index) =>
      result(`test-${String(index).padStart(2, "0")}`, `suite-${index}`, 1000),
    );
    const forward = widget(tests);
    const backward = widget([...tests].reverse());

    expect(backward).toEqual(forward);
    expect(backward.total).toBe(12);
    expect(backward.items.map(({ name }) => name)).toEqual(Array.from({ length: 10 }, (_, index) => `suite-${index}`));
  });
});
