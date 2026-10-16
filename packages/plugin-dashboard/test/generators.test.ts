import type { AllureStore, ReportFiles } from "@allurereport/plugin-api";
import { readReportStaticAssets } from "@allurereport/plugin-api/static-assets";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateEnvirontmentsList, generateStaticFiles } from "../src/generators.js";
import type { DashboardDataWriter } from "../src/writer.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-dashboard");
  await story("generators");
  await label("coverage", "plugin-dashboard");
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
  it("should restore the packaged archive for multi-file reports", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({
      allureVersion: "1.0.0",
      reportDataFiles: [],
      reportFiles,
      reportName: "Test report",
      reportUuid: "report-uuid",
    });

    const assets = await readReportStaticAssets(new URL("../dist/static/report.tar", import.meta.url));
    const scriptFile = assets.manifest["main.js"];
    expect([...files.keys()].sort()).toEqual([...assets.files.keys(), "index.html"].sort());
    const indexHtml = files.get("index.html")?.toString("utf8") ?? "";

    expect(scriptFile).toBeDefined();
    expect(indexHtml).toContain(`src="${scriptFile}"`);
  });

  it("should pass the link to the root overview to the report options", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({
      allureVersion: "1.0.0",
      reportDataFiles: [],
      reportFiles,
      reportName: "Test report",
      reportUuid: "report-uuid",
      overviewHref: "../index.html",
    });

    expect(files.get("index.html")?.toString("utf8")).toContain('"overviewHref":"../index.html"');
  });

  it("should not add the overview link to the report options when there is no overview", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({
      allureVersion: "1.0.0",
      reportDataFiles: [],
      reportFiles,
      reportName: "Test report",
      reportUuid: "report-uuid",
    });

    expect(files.get("index.html")?.toString("utf8")).not.toContain("overviewHref");
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
    const html = files.get("index.html")!.toString("utf8");
    const embedded = html.match(
      /<script id="allure-single-file-assets" type="application\/json">([^<]+)<\/script>/,
    )?.[1];
    expect(embedded).toBeDefined();
    const assets = await readReportStaticAssets(new URL("../dist/static/report.tar", import.meta.url));
    expect(Object.keys(JSON.parse(embedded!)).sort()).toEqual(
      [...assets.files.keys()].filter((name) => name.endsWith(".js")).sort(),
    );
  });
});

describe("generateEnvirontmentsList", () => {
  it("should write environment identities widget", async () => {
    const writer: DashboardDataWriter = {
      writeWidget: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      allEnvironmentIdentities: vi.fn().mockResolvedValue([
        {
          id: "env-1",
          name: "Production",
          variables: {},
          hidden: false,
        },
      ]),
    } as unknown as AllureStore;

    await generateEnvirontmentsList(writer, store);

    expect(writer.writeWidget).toHaveBeenCalledWith("environments.json", [
      {
        id: "env-1",
        name: "Production",
        variables: {},
        hidden: false,
      },
    ]);
  });
});
