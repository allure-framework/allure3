import type { ReportFiles } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { generateDurationTrendData, generateStaticFiles, generateSummaryJson } from "../src/generators.js";
import type { Allure2TestResult } from "../src/model.js";
import type { Allure2DataWriter } from "../src/writer.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("generators");
  await label("coverage", "report-output");
});

const createReportFiles = () => {
  const files = new Map<string, Buffer>();
  const reportFiles: ReportFiles = {
    addFile: async (path, data) => {
      files.set(path, data);
      return path;
    },
  };

  return { files, reportFiles };
};

describe("generateStaticFiles", () => {
  const payload = {
    allureVersion: "1.0.0",
    reportDataFiles: [],
    reportName: "Test report",
    reportUuid: "report-uuid",
    reportLanguage: "en",
    singleFile: false,
  };

  it("should pass the link to the root overview to the report options", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({ ...payload, reportFiles, overviewHref: "../index.html" });

    expect(files.get("index.html")?.toString("utf8")).toContain('"overviewHref":"../index.html"');
  });

  it("should not add the overview link to the report options when there is no overview", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({ ...payload, reportFiles });

    expect(files.get("index.html")?.toString("utf8")).not.toContain("overviewHref");
  });
});

describe("run duration", () => {
  const day = 24 * 60 * 60 * 1000;
  const test = (start: number, stop: number, isRetry = false) =>
    ({ status: "passed", isRetry, time: { start, stop, duration: stop - start } }) as unknown as Allure2TestResult;
  const createWriter = () => {
    const widgets = new Map<string, any>();
    const writer = {
      writeWidget: async (name: string, data: unknown) => void widgets.set(name, data),
    } as unknown as Allure2DataWriter;

    return { widgets, writer };
  };

  it("leaves the pause between merged runs out of the summary and the duration trend", async () => {
    const { widgets, writer } = createWriter();
    const tests = [test(0, 1000), test(day, day + 500)];

    await generateSummaryJson(writer, "report", tests);
    await generateDurationTrendData(writer, tests);

    expect(widgets.get("summary.json").time).toMatchObject({ start: 0, stop: day + 500, duration: 1500 });
    expect(widgets.get("duration-trend.json")[0].data).toEqual({ duration: 1500 });
  });

  it("counts a retried attempt as test activity", async () => {
    const { widgets, writer } = createWriter();
    const minute = 60 * 1000;

    await generateSummaryJson(writer, "report", [
      test(0, minute),
      test(minute, 121 * minute, true),
      test(121 * minute, 122 * minute),
    ]);

    expect(widgets.get("summary.json").statistic.total).toBe(2);
    expect(widgets.get("summary.json").time.duration).toBe(122 * minute);
  });
});
