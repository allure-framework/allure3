import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AllureReport, resolveConfig } from "@allurereport/core";
import { BufferResultFile } from "@allurereport/reader-api";
import { expect, it } from "vite-plus/test";

import { createAgentHumanReportConfig } from "../../../src/commands/agents/human-report.js";

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
