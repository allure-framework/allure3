import type { AllureStore, ReportFiles } from "@allurereport/plugin-api";
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
