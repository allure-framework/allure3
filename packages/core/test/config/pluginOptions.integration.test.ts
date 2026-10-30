import console from "node:console";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BufferResultFile } from "@allurereport/reader-api";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { readConfig } from "../../src/config.js";
import { AllureReport } from "../../src/report.js";

const directories: string[] = [];
const load = async (source: string) => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-plugin-expressions-"));
  directories.push(cwd);
  const output = join(cwd, "report");
  await writeFile(join(cwd, "allurerc.yml"), source);
  return { config: await readConfig(cwd, undefined, { output }), output };
};
const run = async (report: AllureReport) => {
  await report.start();
  const inputs = [
    { uuid: "untimed", status: "failed" },
    { uuid: "slow", status: "failed", start: 0, stop: 30, statusDetails: { message: 'a "quoted", error' } },
    { uuid: "unselected", status: "passed", start: 0, stop: 1 },
    { uuid: "fast", status: "failed", start: 0, stop: 10 },
  ];
  for (const input of inputs) {
    const result = { name: input.uuid, fullName: input.uuid, ...input };
    await report.readResult(new BufferResultFile(Buffer.from(JSON.stringify(result)), `${input.uuid}-result.json`));
  }
  if (report.hasQualityGate) {
    const trs = await report.store.allTestResults({ includeRetries: false });
    const { results } = await report.validate({ trs });
    report.realtimeDispatcher.sendQualityGateResults(results);
  }
  await report.done();
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("plugin expressions through report generation", () => {
  it("generates filtered, sorted, escaped CSV from YAML configuration", async () => {
    const { config, output } = await load(`
plugins:
  export:
    import: '@allurereport/plugin-csv'
    options:
      filter: "\${{ test.status == 'failed' }}"
      sort: >-
        \${{ has(a.duration) && has(b.duration)
            ? a.duration - b.duration
            : (has(a.duration) ? -1.0 : (has(b.duration) ? 1.0 : 0.0)) }}
      fields:
        - header: Name
          accessor: name
        - header: Duration
          accessor: "\${{ has(test.duration) ? dyn(string(test.duration) + ' ms') : null }}"
        - header: Error
          accessor: '\${{ has(test.error) && has(test.error.message) ? test.error.message : null }}'
`);
    const report = new AllureReport(config);

    await run(report);
    const content = await readFile(join(output, "export", "allure-report.csv"), "utf8");

    expect(content).toBe('Name,Duration,Error\n"fast","10 ms",\n"slow","30 ms","a ""quoted"", error"\n"untimed",,');
  });

  it("generates independent CSV exports from two instances of the same plugin", async () => {
    const { config, output } = await load(`
plugins:
  failures:
    import: '@allurereport/plugin-csv'
    options:
      fileName: failures.csv
      filter: "\${{ test.status == 'failed' }}"
      sort: >-
        \${{ has(a.duration) && has(b.duration) ? a.duration - b.duration : has(a.duration) ? -1.0 : has(b.duration) ? 1.0 : 0.0 }}
      fields:
        - header: '\${{ "Failure" }}'
          accessor: '\${{ test.name }}'
  successes:
    import: '@allurereport/plugin-csv'
    options:
      fileName: successes.csv
      filter: "\${{ test.status == 'passed' }}"
      fields:
        - header: Name
          accessor: name
`);
    const report = new AllureReport(config);

    await run(report);
    const failures = await readFile(join(output, "failures", "failures.csv"), "utf8");
    const successes = await readFile(join(output, "successes", "successes.csv"), "utf8");

    expect(failures).toBe('Failure\n"fast"\n"slow"\n"untimed"');
    expect(successes).toBe('Name\n"unselected"');
  });

  it("applies independent test and quality-gate filters to real Log output", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { config } = await load(`
plugins:
  log:
    options:
      groupBy: none
      filter: "\${{ test.name == 'fast' }}"
      qualityGateFilter: "\${{ !result.success && result.rule == 'maxFailures' }}"
qualityGate:
  rules:
    - maxFailures: 0
      minTestsCount: 1
`);
    const report = new AllureReport(config);

    await run(report);
    const output = info.mock.calls.flat().join("\n");

    expect(output).toContain("fast");
    expect(output).not.toContain("slow");
    expect(output).not.toContain("unselected");
    expect(output).toContain("maxFailures");
    expect(output).not.toContain("minTestsCount");
  });
});
