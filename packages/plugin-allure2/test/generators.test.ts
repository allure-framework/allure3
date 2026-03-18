import type { ReportFiles } from "@allurereport/plugin-api";
import { describe, expect, it, vi } from "vitest";

import { generateStaticFiles } from "../src/generators.js";
import { InMemoryReportDataWriter } from "../src/writer.js";

describe("generateStaticFiles", () => {
  it("should generate standalone single-file HTML with posix report-data keys", async () => {
    const writer = new InMemoryReportDataWriter();
    const addedFiles = new Map<string, Buffer>();
    const reportFiles: ReportFiles = {
      addFile: vi.fn(async (path: string, data: Buffer) => {
        addedFiles.set(path, data);
        return path;
      }),
    };

    await writer.writeWidget("widgets\\default\\tree.json", { uid: "tree" });
    await writer.writeData("history\\entry.json", { uid: "history" });

    await generateStaticFiles({
      allureVersion: "3.3.1",
      reportFiles,
      reportDataFiles: writer.reportFiles(),
      reportUuid: "report-uuid",
      reportName: "Allure2 Report",
      reportLanguage: "en",
      singleFile: true,
    });

    expect(Array.from(addedFiles.keys())).toEqual(["index.html"]);

    const indexHtml = addedFiles.get("index.html")?.toString("utf-8") ?? "";

    expect(indexHtml).toContain("data:text/javascript;base64,");
    expect(indexHtml).toContain("data:text/css;base64,");
    expect(indexHtml).toContain("data:image/x-icon;base64,");
    expect(indexHtml).toContain("widgets/default/tree.json");
    expect(indexHtml).toContain("data/history/entry.json");
    expect(indexHtml).toContain("window.allureReportData[");
    expect(indexHtml).not.toContain('src="app-');
    expect(indexHtml).not.toContain('href="styles-');
    expect(indexHtml).not.toContain("widgets\\\\default\\\\tree.json");
    expect(indexHtml).not.toContain("data\\\\history\\\\entry.json");
  });
});
