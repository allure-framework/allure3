import type { AttachmentLink } from "@allurereport/core-api";
import type { ResultFile } from "@allurereport/plugin-api";
import { describe, expect, it, vi } from "vitest";

import { generateAttachmentsFiles } from "../src/generators.js";
import type { ClassicDataWriter } from "../src/writer.js";

describe("generateAttachmentsFiles", () => {
  it("should skip missed attachments and keep writing later available attachments", async () => {
    const writtenContent = { kind: "attachment" } as ResultFile;
    const writer: ClassicDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const attachmentLinks: AttachmentLink[] = [
      {
        id: "missed",
        ext: ".txt",
        originalFileName: "missed.txt",
        name: "missed",
        missed: true,
        used: true,
      },
      {
        id: "written",
        ext: ".txt",
        originalFileName: "written.txt",
        name: "written",
        missed: false,
        used: true,
      },
    ];

    const result = await generateAttachmentsFiles(
      writer,
      attachmentLinks,
      vi.fn(async (id: string) => (id === "written" ? writtenContent : undefined)),
    );

    expect(writer.writeAttachment).toHaveBeenCalledTimes(1);
    expect(writer.writeAttachment).toHaveBeenCalledWith("written.txt", writtenContent);
    expect(result).toEqual(new Map([["written", "written.txt"]]));
  });
});
