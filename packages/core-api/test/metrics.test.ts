import { describe, expect, it } from "vite-plus/test";

import {
  buildMetricHierarchy,
  resolveMetricSamples,
  validatePerformanceConfig,
  type PerformanceMetricConfig,
  type ResolvableMetric,
} from "../src/metrics.js";

const definition = (parent?: string): PerformanceMetricConfig => ({
  title: "Operation",
  unit: "ms",
  better: "lower",
  ...(parent === undefined ? {} : { parent }),
});

describe("performance metric hierarchy", () => {
  it("builds explicit parent links independently of key prefixes, groups and definition order", () => {
    const metrics = {
      "prepare": definition("render"),
      "run.read": definition("run"),
      "render": { ...definition("run"), group: "another group" },
      "run": definition(),
      "run.unrelated": definition(),
    };
    const original = structuredClone(metrics);
    const expected = [
      {
        key: "run",
        children: [
          { key: "render", children: [{ key: "prepare", children: [] }] },
          { key: "run.read", children: [] },
        ],
      },
      { key: "run.unrelated", children: [] },
    ];
    expect(buildMetricHierarchy({ metrics })).toEqual(expected);
    expect(buildMetricHierarchy({ metrics: Object.fromEntries(Object.entries(metrics).reverse()) })).toEqual(expected);
    expect(metrics).toEqual(original);
  });

  it("retains the full configured chain without requiring measured results or inventing values", () => {
    expect(buildMetricHierarchy({ metrics: { a: definition(), b: definition("a"), c: definition("b") } })).toEqual([
      { key: "a", children: [{ key: "b", children: [{ key: "c", children: [] }] }] },
    ]);
    expect(buildMetricHierarchy()).toEqual([]);
  });

  it("handles prototype-like keys as ordinary keys", () => {
    const metrics = JSON.parse(
      '{"__proto__":{"title":"Root","unit":"ms","better":"lower"},"constructor":{"title":"Child","unit":"ms","better":"lower","parent":"__proto__"}}',
    );
    expect(() => validatePerformanceConfig({ metrics })).not.toThrow();
    expect(buildMetricHierarchy({ metrics })).toEqual([
      { key: "__proto__", children: [{ key: "constructor", children: [] }] },
    ]);
  });

  it("matches parent keys exactly without trimming or inferring a hierarchy from names", () => {
    const metrics = { " root ": definition(), "root.child": definition(" root ") };
    expect(() => validatePerformanceConfig({ metrics })).not.toThrow();
    expect(buildMetricHierarchy({ metrics })).toEqual([
      { key: " root ", children: [{ key: "root.child", children: [] }] },
    ]);
  });

  it("validates deeply nested hierarchies without recursive traversal", () => {
    const metrics = Object.fromEntries(
      Array.from({ length: 10_000 }, (_, i) => [String(i), definition(i ? String(i - 1) : undefined)]),
    );
    expect(() => validatePerformanceConfig({ metrics })).not.toThrow();
  });

  it.each([undefined, {}, { metrics: { root: definition() } }])("accepts existing flat config %j", (config) => {
    expect(() => validatePerformanceConfig(config)).not.toThrow();
  });

  it.each(["", null, 123])("rejects invalid parent %j", (parent) => {
    const config = { metrics: { child: { ...definition(), parent } } };
    expect(() =>
      validatePerformanceConfig(config as unknown as Parameters<typeof validatePerformanceConfig>[0]),
    ).toThrow('performance.metrics["child"].parent must be a non-empty metric key');
  });

  it("rejects a missing parent, including inherited object properties", () => {
    for (const parent of ["missing", "constructor", "__proto__"]) {
      expect(() => validatePerformanceConfig({ metrics: { child: definition(parent) } })).toThrow("Unknown parent");
    }
  });

  it("rejects self-parenting and cycles even when there are no measured results", () => {
    expect(() => validatePerformanceConfig({ metrics: { root: definition("root") } })).toThrow("its own parent");
    expect(() =>
      validatePerformanceConfig({
        metrics: {
          a: definition("b"),
          b: definition("c"),
          c: definition("a"),
          leaf: definition("b"),
          unrelated: definition(),
          reachable: definition("unrelated"),
        },
      }),
    ).toThrow('Cyclic performance metric parents: "a", "b", "c", "leaf"');
  });

  it("keeps samples flat and preserves repeated measurements independently of configured parents", () => {
    const samples: ResolvableMetric[] = [
      { id: "one", key: "read", value: 2, start: 1, stop: 3 },
      { id: "two", key: "read", value: 4, start: 2, stop: 6 },
    ];
    const original = structuredClone(samples);
    const resolved = resolveMetricSamples(samples, { metrics: { read: definition("run"), run: definition() } });
    expect(resolved).toEqual(samples.map((sample) => ({ ...sample, title: "Operation", unit: "ms", better: "lower" })));
    expect(samples).toEqual(original);
  });

  it("resolves metric and group metadata only from own config properties", () => {
    const sample = { id: "one", key: "constructor", group: "__proto__", value: 2, start: 1, stop: 3 };
    expect(resolveMetricSamples([sample])).toEqual([sample]);
    const metrics = JSON.parse('{"constructor":{"title":"Own metric","unit":"ms","better":"lower"}}');
    const groups = JSON.parse('{"__proto__":{"title":"Own group"}}');
    expect(resolveMetricSamples([sample], { metrics, groups })).toEqual([
      { ...sample, title: "Own metric", unit: "ms", better: "lower", groupTitle: "Own group" },
    ]);
  });
});
