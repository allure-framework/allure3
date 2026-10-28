import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Config } from "@allurereport/plugin-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { readConfig, resolveConfig } from "../../src/config.js";
import { AllureReport } from "../../src/report.js";

const directories: string[] = [];
const datedName = "${{ env.ALLURE_NAME + ' / ' + date.isoDate }}";
const resolve = (config: Config) => resolveConfig(config, { plugins: {} });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T23:59:58.123Z"));
  vi.stubEnv("ALLURE_NAME", "nightly");
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("name and title expressions", () => {
  it("resolves report and environment display names before environment selection", async () => {
    const matcher = () => true;
    const environmentName = "${{ env.ALLURE_NAME + ' - ' + date.isoDate }}";
    const input: Config = {
      name: datedName,
      environments: { linux: { name: environmentName, matcher } },
      environment: "nightly - 2026-10-27",
    };

    const config = await resolve(input);

    expect(config.name).toBe("nightly / 2026-10-27");
    expect(config.environment).toBe("linux");
    expect(config.environments!.linux).toEqual({ name: "nightly - 2026-10-27", matcher });
    expect(input.name).toBe(datedName);
    expect(input.environments!.linux.name).toBe(environmentName);
  });

  it("uses the effective report name override without evaluating the replaced value", async () => {
    const config = await resolveConfig({ name: "${{ missing }}" }, { name: datedName, plugins: {} });

    expect(config.name).toBe("nightly / 2026-10-27");
  });

  it.each([false, true])("resolves category names in the object form: %s", async (objectForm) => {
    const rules = [{ name: datedName, matchers: { statuses: ["failed"] as const } }];

    const config = await resolve({ categories: objectForm ? { rules } : rules });

    expect(config.categories).toEqual(
      objectForm
        ? { rules: [{ ...rules[0], name: "nightly / 2026-10-27" }] }
        : [{ ...rules[0], name: "nightly / 2026-10-27" }],
    );
    expect(rules[0].name).toBe(datedName);
  });

  it.each([
    ["awesome", "reportName"],
    ["classic", "reportName"],
    ["dashboard", "reportName"],
    ["allure2", "reportName"],
    ["mail", "title"],
    ["testops", "launchName"],
    ["agent", "agentName"],
  ])("resolves %s %s using the imported plugin implementation", async (kind, field) => {
    const options = { [field]: datedName };

    const config = await resolveConfig({ plugins: { report: { import: `@allurereport/plugin-${kind}`, options } } });
    const plugin = config.plugins!.find(({ id }) => id === "report")!;

    expect(plugin.options[field]).toBe("nightly / 2026-10-27");
    expect(options[field]).toBe(datedName);
  });

  it.each([
    ["awesome", "charts"],
    ["dashboard", "layout"],
  ])("resolves nested %s chart titles without replacing literal entries", async (kind, field) => {
    const literal = { type: "status", title: "Status" };
    const chart = { type: "status", title: datedName };

    const config = await resolveConfig({ plugins: { [kind]: { options: { [field]: [literal, chart] } } } });
    const charts = config.plugins!.find(({ id }) => id === kind)!.options[field];

    expect(charts[0]).toBe(literal);
    expect(charts[1]).toEqual({ ...chart, title: "nightly / 2026-10-27" });
    expect(chart.title).toBe(datedName);
  });

  it("resolves CSV headers alongside native and expression accessors", async () => {
    const accessor = () => "native";
    const sort = () => 0;
    const fields = [
      { header: datedName, accessor },
      { header: "Name", accessor: "${{ test.name }}" },
    ];

    const config = await resolveConfig({ plugins: { csv: { options: { fields, sort } } } });
    const options = config.plugins!.find(({ id }) => id === "csv")!.options;

    expect(options.fields[0]).toEqual({ header: "nightly / 2026-10-27", accessor });
    expect(options.fields[1].accessor({ name: "example" })).toBe("example");
    expect(options.sort).toBe(sort);
    expect(fields[0].header).toBe(datedName);
  });

  it("reports a name expression returning a non-string at its configuration path", async () => {
    const resolution = resolve({ name: "${{ 42 }}" });

    await expect(resolution).rejects.toThrow(/name.*must return a string/);
  });

  it("keeps literal names and unsupported plugin names untouched", async () => {
    const options = { title: "${{ unknown }}" };

    const config = await resolveConfig({
      name: "Literal report",
      plugins: { custom: { import: "@allurereport/plugin-progress", options } },
    });

    expect(config.name).toBe("Literal report");
    expect(config.plugins!.find(({ id }) => id === "custom")!.options).toBe(options);
  });

  it("provides an ISO instant and UTC calendar and epoch fields to names", async () => {
    const config = await resolve({
      name: "${{ date.iso + ' ' + string(date.year) + '-' + string(date.month) + '-' + string(date.day) + ' ' + string(date.unixMs) }}",
    });

    expect(config.name).toBe(`2026-10-27T23:59:58.123Z 2026-10-27 ${Date.now()}`);
  });

  it("writes a literal YAML CSV name expression into the exported header", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure-name-expression-"));
    directories.push(cwd);
    const output = join(cwd, "report");
    await writeFile(
      join(cwd, "allurerc.yml"),
      `
name: "\${{ env.ALLURE_NAME + ' ' + date.isoDate }}"
plugins:
  csv:
    options:
      fields:
        - header: "\${{ 'Name / ' + date.isoDate }}"
          accessor: name
`,
    );
    const config = await readConfig(cwd, undefined, { output });
    const report = new AllureReport(config);
    await report.start();
    await report.readResult(
      new BufferResultFile(
        Buffer.from(JSON.stringify({ name: "example", fullName: "example", status: "passed", start: 0, stop: 1 })),
        "example-result.json",
      ),
    );
    await report.done();

    const csv = await readFile(join(output, "allure-report.csv"), "utf8");

    expect(config.name).toBe("nightly 2026-10-27");
    expect(csv).toBe('Name / 2026-10-27\n"example"');
  });
});
