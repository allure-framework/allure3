import { BufferResultFile } from "@allurereport/reader-api";
import console from "node:console";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { exportAttachments } from "./cli.js";
import type { AttachmentFileFactory } from "./model.js";

export const parseWithExportedAttachments = async (
  xcResultPath: string,
  fn: (createAttachmentFile: AttachmentFileFactory) => Promise<void>,
) => {
  let attachmentsDir: string | undefined;
  try {
    attachmentsDir = await mkdtemp("allure-");
    await exportAttachments(xcResultPath, attachmentsDir);
    await fn(createAttachmentFileFactoryFn(attachmentsDir));
  } finally {
    if (attachmentsDir) {
      try {
        await rm(attachmentsDir, { recursive: true, force: true });
      } catch (e) {
        console.error("when parsing", xcResultPath, "- can't remove the tmp dir", attachmentsDir, ":", e);
      }
    }
  }
};

const createAttachmentFileFactoryFn =
  (attachmentsDir: string): AttachmentFileFactory =>
  async (attachmentUuid, uniqueFileName) => {
    const attachmentFilePath = path.join(attachmentsDir, attachmentUuid);
    try {
      const content = await readFile(attachmentFilePath);
      return new BufferResultFile(content, uniqueFileName);
    } catch (e) {
      console.error("Can't read attachment", attachmentUuid, "in", attachmentsDir, ":", e);
    }
  };
