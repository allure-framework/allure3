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
  it("builds explicit parent links independently of key prefixes and input order", () => {
    const metrics = [
      { key: "prepare", parent: "render" },
      { key: "run.read", parent: "run" },
      { key: "render", parent: "run" },
      { key: "run" },
      { key: "run.unrelated" },
    ];
    const original = structuredClone(metrics);
    expect(buildMetricHierarchy(metrics)).toEqual([
      {
        key: "run",
        children: [
          { key: "run.read", children: [] },
          { key: "render", children: [{ key: "prepare", children: [] }] },
        ],
      },
      { key: "run.unrelated", children: [] },
    ]);
    expect(metrics).toEqual(original);
  });

  it("deduplicates metric keys but does not invent missing parent measurements", () => {
    expect(
      buildMetricHierarchy([{ key: "read", parent: "run" }, { key: "read", parent: "run" }, { key: "unrelated" }]),
    ).toEqual([
      { key: "read", children: [] },
      { key: "unrelated", children: [] },
    ]);
    expect(buildMetricHierarchy([])).toEqual([]);
  });

  it("handles prototype-like keys as ordinary keys", () => {
    const metrics = JSON.parse(
      '{"__proto__":{"title":"Root","unit":"ms","better":"lower"},"constructor":{"title":"Child","unit":"ms","better":"lower","parent":"__proto__"}}',
    );
    expect(() => validatePerformanceConfig({ metrics })).not.toThrow();
    expect(buildMetricHierarchy([{ key: "constructor", parent: "__proto__" }, { key: "__proto__" }])).toEqual([
      { key: "__proto__", children: [{ key: "constructor", children: [] }] },
    ]);
  });

  it("matches parent keys exactly without trimming or inferring a hierarchy from names", () => {
    const metrics = { " root ": definition(), "root.child": definition(" root ") };
    expect(() => validatePerformanceConfig({ metrics })).not.toThrow();
    expect(buildMetricHierarchy([{ key: "root.child", parent: " root " }, { key: " root " }])).toEqual([
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
          unrelated: definition(),
        },
      }),
    ).toThrow('Cyclic performance metric parents: "a", "b", "c"');
  });

  it("enriches parents only from current config without changing samples or collapsing repeats", () => {
    const samples: ResolvableMetric[] = [
      { id: "one", key: "read", value: 2, start: 1, stop: 3, parent: "stale" },
      { id: "two", key: "read", value: 4, start: 2, stop: 6 },
    ];
    const original = structuredClone(samples);
    const resolved = resolveMetricSamples(samples, { metrics: { read: definition("run"), run: definition() } });
    expect(resolved.map(({ id, value, start, stop, parent }) => ({ id, value, start, stop, parent }))).toEqual([
      { id: "one", value: 2, start: 1, stop: 3, parent: "run" },
      { id: "two", value: 4, start: 2, stop: 6, parent: "run" },
    ]);
    expect(resolveMetricSamples(samples).every((sample) => !Object.hasOwn(sample, "parent"))).toBe(true);
    expect(samples).toEqual(original);
  });
});
