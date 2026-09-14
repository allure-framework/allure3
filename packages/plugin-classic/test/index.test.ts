import type { ReportFiles } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { generateStaticFiles } from "../src/generators.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-classic");
  await story("index");
  await label("coverage", "plugin-classic");
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

describe("static report assets", () => {
  it("should restore the packaged archive for multi-file reports", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({
      allureVersion: "1.0.0",
      reportDataFiles: [],
      reportFiles,
      reportName: "Test report",
      reportUuid: "report-uuid",
    });

    const scriptFile = [...files.keys()].find((path) => path.endsWith(".js"));
    const indexHtml = files.get("index.html")?.toString("utf8") ?? "";

    expect(scriptFile).toBeDefined();
    expect(indexHtml).toContain(`src="${scriptFile}"`);
  });

  it("should embed the packaged bundle for single-file reports", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({
      allureVersion: "1.0.0",
      reportDataFiles: [],
      reportFiles,
      reportName: "Test report",
      reportUuid: "report-uuid",
      singleFile: true,
    });

    expect([...files.keys()]).toEqual(["index.html"]);
    expect(files.get("index.html")?.toString("utf8")).toContain("data:text/javascript;base64,");
  });
});
