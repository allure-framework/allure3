import type { TestResult } from "@allurereport/core-api";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveConfig } from "../../src/config.js";

const resolvePlugin = async (id: string, options: Record<string, unknown>, path?: string) => {
  const config = await resolveConfig({ plugins: { [id]: { import: path, options } } });
  return config.plugins.find((plugin) => plugin.id === id)!;
};
const test = (name: string, status = "passed") => ({ name, status, labels: [] }) as unknown as TestResult;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("plugin option expressions", () => {
  it.each(["awesome", "classic", "dashboard", "csv", "log", "testops"])("normalizes %s test filters", async (id) => {
    const plugin = await resolvePlugin(id, { filter: "${{ test.status == 'failed' }}" });

    const selected = [test("passing"), test("failure", "failed")].filter(plugin.options.filter);

    expect(selected.map(({ name }) => name)).toEqual(["failure"]);
  });

  it("normalizes explicit builtin imports with custom instance IDs without mutating input", async () => {
    const options = { filter: "${{ test.name == 'selected' }}", title: "${{ literal }}" };
    const plugin = await resolvePlugin("my_report", options, "@allurereport/plugin-awesome");

    const selected = plugin.options.filter(test("selected"));

    expect({ selected, original: options.filter, title: plugin.options.title }).toEqual({
      selected: true,
      original: "${{ test.name == 'selected' }}",
      title: "${{ literal }}",
    });
    expect(Reflect.get(plugin.plugin, "options")).toBe(plugin.options);
  });

  it("captures environment variables once for filtering", async () => {
    vi.stubEnv("ALLURE_PLUGIN_STATUS", "failed");
    const plugin = await resolvePlugin("csv", {
      filter: "${{ has(env.ALLURE_PLUGIN_STATUS) && test.status == env.ALLURE_PLUGIN_STATUS }}",
    });
    vi.stubEnv("ALLURE_PLUGIN_STATUS", "passed");

    const selected = [test("pass"), test("fail", "failed")].filter(plugin.options.filter);

    expect(selected.map(({ name }) => name)).toEqual(["fail"]);
  });

  it("filters Log quality-gate outcomes with a distinct result context", async () => {
    const plugin = await resolvePlugin("log", {
      qualityGateFilter: "${{ !result.success && result.rule == 'maxFailures' }}",
    });

    const outcomes = [
      { success: true, rule: "maxFailures" },
      { success: false, rule: "maxFailures" },
      { success: false, rule: "minTestsCount" },
    ].filter(plugin.options.qualityGateFilter);

    expect(outcomes).toEqual([{ success: false, rule: "maxFailures" }]);
  });

  it("preserves native callback and option identity", async () => {
    const filter = () => true;
    const options = { filter };
    const plugin = await resolvePlugin("csv", options);

    expect(plugin.options).toBe(options);
    expect(plugin.options.filter).toBe(filter);
  });

  it("does not reinterpret unsupported plugin options despite a builtin-like instance ID", async () => {
    const options = { filter: "${{ this remains literal }}" };
    const plugin = await resolvePlugin("csv", options, "@allurereport/plugin-progress");

    expect(plugin.options).toBe(options);
  });

  it("projects nested CSV values and maps null to empty cells", async () => {
    const fields = [
      { header: "Error", accessor: "${{ has(test.error) ? test.error.message : null }}" },
      { header: "Name", accessor: "name" },
    ];
    const plugin = await resolvePlugin("csv", { fields });
    const accessor = plugin.options.fields[0].accessor;

    const cells = [accessor({ error: { message: "quoted, failure" } }), accessor({})];

    expect(cells).toEqual(["quoted, failure", undefined]);
    expect(plugin.options.fields[1]).toBe(fields[1]);
    expect(fields[0].accessor).toBe("${{ has(test.error) ? test.error.message : null }}");
  });

  it("preserves native CSV accessors and sorting alongside expression fields", async () => {
    const accessor = (value: TestResult) => value.name;
    const sort = (a: TestResult, b: TestResult) => a.name.localeCompare(b.name);
    const plugin = await resolvePlugin("csv", {
      fields: [
        { header: "Name", accessor },
        { header: "Status", accessor: "${{ test.status }}" },
      ],
      sort,
    });

    expect(plugin.options.fields[0].accessor).toBe(accessor);
    expect(plugin.options.sort).toBe(sort);
  });

  it.each(["${{ a.duration - b.duration }}", "${{ double(a.duration) - double(b.duration) }}"])(
    "sorts CSV rows numerically using %s",
    async (sort) => {
      const plugin = await resolvePlugin("csv", { sort });
      const rows = [{ duration: 12 }, { duration: 3 }, { duration: 12 }];

      const ordered = [...rows].sort(plugin.options.sort);

      expect(ordered).toEqual([rows[1], rows[0], rows[2]]);
      expect(plugin.options.sort(rows[0], rows[2])).toBe(0);
    },
  );

  it("converts unsigned CEL comparator integers to JavaScript numbers", async () => {
    const plugin = await resolvePlugin("csv", { sort: "${{ 1u }}" });

    const comparison = plugin.options.sort(test("a"), test("b"));

    expect(comparison).toBe(1);
  });

  it("rejects non-text CSV cells with the field configuration path", async () => {
    const plugin = await resolvePlugin("csv", { fields: [{ header: "Duration", accessor: "${{ test.duration }}" }] });

    expect(() => plugin.options.fields[0].accessor({ duration: 12 })).toThrow(
      'plugins["csv"].options.fields[0].accessor',
    );
  });

  it.each(["${{ 9007199254740992 }}", "${{ double(a.value) }}", "${{ 'wrong' }}"])(
    "rejects unusable comparator results from %s",
    async (sort) => {
      const plugin = await resolvePlugin("csv", { sort });

      expect(() => plugin.options.sort({ value: "Infinity" }, {})).toThrow('plugins["csv"].options.sort');
    },
  );

  it("rejects malformed filters during configuration resolution with their path", async () => {
    await expect(resolvePlugin("csv", { filter: "${{ test. }}" })).rejects.toThrow('plugins["csv"].options.filter');
  });

  it("reports runtime filter failures instead of silently dropping tests", async () => {
    const plugin = await resolvePlugin("csv", { filter: "${{ test.error.message == 'failure' }}" });

    expect(() => plugin.options.filter(test("missing error"))).toThrow('plugins["csv"].options.filter');
  });
});
