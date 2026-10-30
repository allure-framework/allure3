import { ChartType } from "@allurereport/charts-api";
import type { UIChartsData } from "@allurereport/web-commons";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createTreeWidgetData, findTrendChart } from "../../src/utils/overview.js";
import type { ReportTree } from "../../types.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("overview");
  await label("coverage", "ui-components");
});

const createTree = (groups: Record<string, { name: string; statistic: Record<string, number> }>, order?: string[]) =>
  ({
    root: { groups: order ?? Object.keys(groups), leaves: ["orphan"] },
    groupsById: Object.fromEntries(
      Object.entries(groups).map(([id, group]) => [id, { nodeId: id, groups: [], leaves: [], ...group }]),
    ),
    leavesById: {},
  }) as unknown as ReportTree;

describe("utils > overview > createTreeWidgetData", () => {
  it("lists the top level groups with the most failed and broken tests first", () => {
    const tree = createTree({
      a: { name: "passing", statistic: { total: 5, passed: 5 } },
      b: { name: "broken", statistic: { total: 3, broken: 2, passed: 1 } },
      c: { name: "failing", statistic: { total: 2, failed: 1, passed: 1 } },
      d: { name: "more broken", statistic: { total: 4, broken: 3, passed: 1 } },
    });

    const data = createTreeWidgetData(tree);

    // 4 groups and 1 test outside of any group
    expect(data.total).toBe(5);
    expect(data.items.map(({ name }) => name)).toEqual(["failing", "more broken", "broken", "passing"]);
    expect(data.items[0]).toEqual({ id: "c", name: "failing", statistic: { total: 2, failed: 1, passed: 1 } });
  });

  it("keeps only the given number of items but counts all top level nodes", () => {
    const groups = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`g${i}`, { name: `group ${i}`, statistic: { total: 1, passed: 1 } }]),
    );

    const data = createTreeWidgetData(createTree(groups));

    expect(data.total).toBe(13);
    expect(data.items).toHaveLength(10);
    expect(data.items[0].name).toBe("group 0");
    expect(createTreeWidgetData(createTree(groups), 3).items).toHaveLength(3);
  });

  it("skips unknown groups and handles empty trees", () => {
    const tree = createTree({ a: { name: "a", statistic: { total: 1, passed: 1 } } }, ["a", "missing"]);

    expect(createTreeWidgetData(tree)).toEqual({
      items: [{ id: "a", name: "a", statistic: { total: 1, passed: 1 } }],
      total: 2,
    });
    expect(createTreeWidgetData(undefined)).toEqual({ items: [], total: 0 });
    expect(createTreeWidgetData({ root: {}, groupsById: {}, leavesById: {} } as ReportTree)).toEqual({
      items: [],
      total: 0,
    });
  });
});

describe("utils > overview > findTrendChart", () => {
  it("returns the status dynamics chart", () => {
    const trend = { type: ChartType.StatusDynamics, title: "Status dynamics" };
    const charts = {
      pie: { type: ChartType.CurrentStatus },
      trend,
    } as unknown as UIChartsData;

    expect(findTrendChart(charts)).toBe(trend);
    expect(findTrendChart({ pie: { type: ChartType.CurrentStatus } } as unknown as UIChartsData)).toBeUndefined();
    expect(findTrendChart(undefined)).toBeUndefined();
  });
});
