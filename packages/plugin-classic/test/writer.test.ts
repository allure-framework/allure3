import type { ResultFile } from "@allurereport/plugin-api";
import { describe, expect, it, vi } from "vitest";

import { InMemoryReportDataWriter } from "../src/writer.js";

describe("InMemoryReportDataWriter", () => {
  it("should store normalized POSIX keys for report data", async () => {
    const writer = new InMemoryReportDataWriter();
    const attachment: ResultFile = {
      asBuffer: vi.fn().mockResolvedValue(Buffer.from("attachment")),
      writeTo: vi.fn(),
      getOriginalFileName: vi.fn(),
      getExtension: vi.fn(),
      getContentType: vi.fn(),
      getContentLength: vi.fn(),
    } as unknown as ResultFile;

    await writer.writeData("history\\entry.json", { id: 1 });
    await writer.writeWidget("default\\tree.json", { id: 2 });
    await writer.writeTestCase({ id: "tr-1" } as any);
    await writer.writeAttachment("foo\\bar.txt", attachment);

    const names = writer.reportFiles().map((file) => file.name);

    expect(names).toContain("data/history/entry.json");
    expect(names).toContain("widgets/default/tree.json");
    expect(names).toContain("data/test-results/tr-1.json");
    expect(names).toContain("data/attachments/foo/bar.txt");
  });
});
