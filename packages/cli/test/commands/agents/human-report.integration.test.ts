import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AllureReport, resolveConfig } from "@allurereport/core";
import TestOpsPlugin from "@allurereport/core/testops";
import { formatAgentRunSummary, loadAgentOutput } from "@allurereport/plugin-agent";
import { BufferResultFile } from "@allurereport/reader-api";
import { expect, it, vi } from "vite-plus/test";

import { createAgentHumanReportConfig } from "../../../src/commands/agents/human-report.js";

const generateConfiguredAgentReport = async (cwd: string, configPath: string, outputDir: string) => {
  const humanReport = await createAgentHumanReportConfig({ mode: "config", cwd, configPath, outputDir });
  const config = await resolveConfig(
    {},
    {
      cwd,
      output: outputDir,
      plugins: { agent: { options: { outputDir, humanReport: humanReport.statusProvider } } },
    },
  );
  const report = new AllureReport({
    ...config,
    plugins: [...humanReport.plugins, ...(config.plugins ?? [])],
  });
  await report.start();
  await report.done();
  return loadAgentOutput(outputDir);
};

it("generates an auto human report with configured Awesome expressions", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-agent-expressions-"));

  try {
    const configPath = join(cwd, "allurerc.json");
    const outputDir = join(cwd, "report");
    await writeFile(
      configPath,
      JSON.stringify({
        plugins: {
          failures: {
            import: "@allurereport/plugin-awesome",
            options: {
              filter: '${{ test.status == "failed" }}',
              reportName: '${{ date.year >= 2000 ? "Failures" : "Other" }}',
              singleFile: false,
            },
          },
        },
      }),
    );
    const humanReport = await createAgentHumanReportConfig({ mode: "auto", cwd, configPath, outputDir });
    const config = await resolveConfig({}, { cwd, output: outputDir, plugins: {} });
    const report = new AllureReport({ ...config, plugins: humanReport.plugins });

    await report.start();
    for (const status of ["failed", "passed"]) {
      await report.readResult(
        new BufferResultFile(
          Buffer.from(
            JSON.stringify({
              uuid: status,
              name: `${status} test`,
              fullName: `${status} test`,
              status,
              stage: "finished",
              start: 1,
              stop: 2,
              labels: [],
            }),
          ),
          `${status}-result.json`,
        ),
      );
    }
    await report.done();
    const html = await readFile(join(outputDir, "index.html"), "utf8");
    const [, statistic] = html.match(/d\("widgets\/statistic\.json","([^"]+)"\)/)!;

    expect(humanReport.plugins[0].options.singleFile).toBe(true);
    expect(humanReport.plugins[0].options.reportName).toBe("Failures");
    expect(humanReport.status).toMatchObject({ status: "generated", error: null, path: "awesome/index.html" });
    expect(JSON.parse(Buffer.from(statistic, "base64").toString("utf8"))).toEqual({ total: 1, failed: 1 });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

it("includes top-level TestOps only for explicitly configured human reports", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-agent-testops-"));
  try {
    const configPath = join(cwd, "allurerc.json");
    await writeFile(
      configPath,
      JSON.stringify({
        testops: { enabled: true, projectId: "1", endpoint: "https://example.invalid", accessToken: "fixture" },
      }),
    );
    for (const [mode, ids] of [
      ["off", []],
      ["auto", ["awesome"]],
      ["awesome", ["awesome"]],
      ["config", ["awesome", "testops"]],
    ] as const) {
      const report = await createAgentHumanReportConfig({ mode, cwd, configPath, outputDir: join(cwd, "out") });
      expect(report.plugins.map(({ id }) => id)).toEqual(ids);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

it.each([
  ["native", undefined],
  ["native", "https://testops.example/launch/42"],
  ["legacy", undefined],
  ["legacy", "https://testops.example/launch/42"],
  ["custom", "https://reports.example/run/42"],
] as const)("records only the link returned by the %s report plugin (%s)", async (adapter, remoteHref) => {
  const cwd = await mkdtemp(join(tmpdir(), "allure-agent-testops-link-"));
  try {
    const configPath = join(cwd, "allurerc.json");
    const outputDir = join(cwd, "out");
    let pluginImport = "testops";
    let Plugin = TestOpsPlugin;
    if (adapter !== "native") {
      const name = adapter === "legacy" ? "@allurereport/plugin-testops" : "@example/remote-report";
      const dir = join(cwd, "node_modules", name);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "package.json"), JSON.stringify({ name, exports: "./index.cjs" }));
      await writeFile(
        join(dir, "index.cjs"),
        "module.exports = class ReportPlugin { start() {} done() {} info() {} };",
      );
      const require = createRequire(configPath);
      pluginImport = require.resolve(name);
      Plugin = require(pluginImport);
    }
    await writeFile(configPath, JSON.stringify({ plugins: { upload: { import: pluginImport }, awesome: {} } }));
    const start = vi.spyOn(Plugin.prototype, "start").mockResolvedValue(undefined);
    const done = vi.spyOn(Plugin.prototype, "done").mockResolvedValue(undefined);
    const info = vi
      .spyOn(Plugin.prototype, "info")
      .mockResolvedValue(
        remoteHref ? { name: "Launch", remoteHref, stats: { total: 0 }, status: "unknown", duration: 0 } : undefined,
      );
    const { humanReport, run } = await generateConfiguredAgentReport(cwd, configPath, outputDir);

    expect(start).toHaveBeenCalledOnce();
    expect(done).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledOnce();
    expect(humanReport?.reports).toEqual([
      ...(remoteHref ? [{ plugin_id: "upload", path: remoteHref }] : []),
      { plugin_id: "awesome", path: "awesome/" },
    ]);
    expect(humanReport).toMatchObject({ path: remoteHref ?? "awesome/", status: "generated" });
    if (remoteHref) {
      expect(formatAgentRunSummary({ outputDir, run, humanReport })).toContain(
        `Here is the report: [report](${remoteHref})`,
      );
    }
  } finally {
    vi.restoreAllMocks();
    await rm(cwd, { recursive: true, force: true });
  }
});
