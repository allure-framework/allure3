import { BufferResultFile } from "@allurereport/reader-api";
import { attachment, step } from "allure-js-commons";
import { describe, expect, it } from "vitest";

import { attachments } from "../src/attachments/index.js";
import { mockVisitor } from "./utils.js";

describe("attachments reader", () => {
  it("should pass attachment files through to the visitor", async () => {
    const visitor = mockVisitor();

    const resultFile = await step("prepare an attachment result file", async () => {
      const file = new BufferResultFile(Buffer.from("attachment content", "utf-8"), "example.txt");
      await attachment("attachment-input.txt", Buffer.from("attachment content", "utf-8"), "text/plain");
      return file;
    });

    const read = await step("read the attachment file", async () => {
      return await attachments.read(visitor, resultFile);
    });

    await step("verify the attachment was forwarded unchanged", async () => {
      expect(read).toBe(true);
      expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
      expect(visitor.visitAttachmentFile).toHaveBeenCalledWith(resultFile, { readerId: "attachments" });
    });
  });
});
