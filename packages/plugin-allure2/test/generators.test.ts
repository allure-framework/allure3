import type { ReportFiles } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { generateStaticFiles } from "../src/generators.js";

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
