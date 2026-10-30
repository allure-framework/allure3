import { fileURLToPath } from "node:url";

import type { TestResult } from "@allurereport/core-api";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { getPluginId, resolveConfig } from "../../src/config.js";

const resolvePlugin = async (id: string, options: Record<string, unknown>, path?: string) => {
  const config = await resolveConfig({ plugins: { [id]: { import: path, options } } });
  return config.plugins!.find((plugin) => plugin.id === getPluginId(id))!;
};
const test = (name: string, status = "passed") => ({ name, status, labels: [] }) as unknown as TestResult;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("plugin option expressions", () => {
  it.each(["awesome", "classic", "dashboard", "csv", "log", "testops"])("normalizes %s test filters", async (kind) => {
    const plugin = await resolvePlugin(
      `${kind}-failed`,
      { filter: "${{ test.status == 'failed' }}" },
      `@allurereport/plugin-${kind}`,
    );

    const selected = [test("passing"), test("failure", "failed")].filter(plugin.options.filter);

    expect(selected.map(({ name }) => name)).toEqual(["failure"]);
  });

  it("normalizes supported options without mutating input or unrelated fields", async () => {
    const options = { filter: "${{ test.name == 'selected' }}", title: "${{ literal }}" };
    const plugin = await resolvePlugin("awesome", options);

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

  it.each(["export", "@allurereport/plugin-csv"])("normalizes CSV expressions for %s", async (id) => {
    const plugin = await resolvePlugin(
      id,
      {
        sort: "${{ a.duration - b.duration }}",
        fields: [{ header: "${{ 'Name' }}", accessor: "${{ test.name }}" }],
      },
      id === "export" ? "@allurereport/plugin-csv" : undefined,
    );

    const rows = [
      { name: "slow", duration: 2 },
      { name: "fast", duration: 1 },
    ].sort(plugin.options.sort);
    const cells = rows.map(plugin.options.fields[0].accessor);

    expect({ header: plugin.options.fields[0].header, cells }).toEqual({ header: "Name", cells: ["fast", "slow"] });
  });

  it("reports the configured alias and nested field on invalid expressions", async () => {
    const plugin = resolvePlugin(
      "export",
      {
        fields: [
          { header: "Name", accessor: "name" },
          { header: "Error", accessor: "${{ test. }}" },
        ],
      },
      "@allurereport/plugin-csv",
    );

    await expect(plugin).rejects.toThrow('Invalid expression at plugins["export"].options.fields[1].accessor');
  });

  it("normalizes third-party declarations while preserving undeclared values and unchanged entries", async () => {
    const path = fileURLToPath(new URL("../fixtures/expression-plugin.mjs", import.meta.url));
    const unchanged = { title: "Literal", fields: [] };
    const options = {
      filter: "${{ test.status == 'failed' }}",
      sections: [
        null,
        1,
        [],
        unchanged,
        {
          title: "${{ 'Dynamic' }}",
          fields: [{ header: "${{ 'Name' }}" }, { header: "${{ 'Status' }}" }],
        },
      ],
      opaque: "${{ not an expression }}",
    };
    const original = structuredClone(options);
    const plugin = await resolvePlugin("custom", options, path);

    const selected = plugin.options.filter(test("failure", "failed"));

    expect(selected).toBe(true);
    expect(plugin.options.sections).toEqual([
      null,
      1,
      [],
      unchanged,
      {
        title: "Dynamic",
        fields: [{ header: "Name" }, { header: "Status" }],
      },
    ]);
    expect(plugin.options.sections[3]).toBe(unchanged);
    expect(plugin.options.opaque).toBe(options.opaque);
    expect(options).toEqual(original);
    expect(Reflect.get(plugin.plugin, "options")).toBe(plugin.options);
  });

  it("normalizes plugin-owned resolvers with captured env and preserves literal and native accessors", async () => {
    vi.stubEnv("ALLURE_CUSTOM_SUFFIX", "-captured");
    const path = fileURLToPath(new URL("../fixtures/custom-expression-plugin.mjs", import.meta.url));
    const native = { accessor: (item: TestResult) => item.name };
    const literal = { accessor: "name" };
    const options = {
      fields: [native, literal, { accessor: "${{ item.name + env.ALLURE_CUSTOM_SUFFIX }}" }],
      opaque: "${{ remains literal }}",
    };

    const plugin = await resolvePlugin("custom", options, path);
    vi.stubEnv("ALLURE_CUSTOM_SUFFIX", "-changed");
    const value = plugin.options.fields[2].accessor(test("selected"));

    expect(value).toBe("selected-captured");
    expect(plugin.options.fields[0]).toBe(native);
    expect(plugin.options.fields[1]).toBe(literal);
    expect(plugin.options.opaque).toBe(options.opaque);
    expect(options.fields[2].accessor).toBe("${{ item.name + env.ALLURE_CUSTOM_SUFFIX }}");
  });

  it("reports the nested custom resolver path on compilation errors", async () => {
    const path = fileURLToPath(new URL("../fixtures/custom-expression-plugin.mjs", import.meta.url));

    const plugin = resolvePlugin("custom", { fields: [{ accessor: "${{ item. }}" }] }, path);

    await expect(plugin).rejects.toThrow('Invalid expression at plugins["custom"].options.fields[0].accessor');
  });

  it("reports the nested custom resolver path on deferred errors", async () => {
    const path = fileURLToPath(new URL("../fixtures/custom-expression-plugin.mjs", import.meta.url));
    const plugin = await resolvePlugin("custom", { fields: [{ accessor: "${{ item.missing }}" }] }, path);

    const evaluate = () => plugin.options.fields[0].accessor(test("selected"));

    expect(evaluate).toThrow('Invalid expression at plugins["custom"].options.fields[0].accessor');
  });

  it.each([undefined, [], "literal"])("preserves third-party collection identity for %j", async (sections) => {
    const path = fileURLToPath(new URL("../fixtures/expression-plugin.mjs", import.meta.url));
    const options = { sections };

    const plugin = await resolvePlugin("custom", options, path);

    expect(plugin.options).toBe(options);
  });

  it("preserves native callbacks and literal options on built-in aliases", async () => {
    const filter = () => true;
    const sort = () => 0;
    const options = { filter, sort, fields: [{ header: "Name", accessor: "name" }], reportName: "${{ literal }}" };

    const plugin = await resolvePlugin("export", options, "@allurereport/plugin-csv");

    expect(plugin.options).toBe(options);
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

  it("rejects malformed filters during configuration resolution with their path", async () => {
    await expect(resolvePlugin("csv", { filter: "${{ test. }}" })).rejects.toThrow('plugins["csv"].options.filter');
  });

  it("reports runtime filter failures instead of silently dropping tests", async () => {
    const plugin = await resolvePlugin("csv", { filter: "${{ test.error.message == 'failure' }}" });

    expect(() => plugin.options.filter(test("missing error"))).toThrow('plugins["csv"].options.filter');
  });
});
