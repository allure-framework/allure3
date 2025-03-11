import { BufferResultFile } from "@allurereport/reader-api";
import console from "node:console";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { exportAttachments } from "./cli.js";
import type { AttachmentFileFactory } from "./model.js";

const AUTO_VIDEO_CAPTURE_NAME = "kXCTAttachmentScreenRecording";
const AUTO_SCREENSHOT_CAPTURE_NAME = "kXCTAttachmentLegacyScreenImageData";

export const parseWithExportedAttachments = async (
  xcResultPath: string,
  fn: (createAttachmentFile: AttachmentFileFactory) => Promise<void>,
) => {
  let attachmentsDir: string | undefined;
  try {
    attachmentsDir = await mkdtemp(path.join(tmpdir(), "allure-reader-xcresult-"));
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

export const mapWellKnownAttachmentName = (name: string | undefined, timestamp: number | undefined) => {
  switch (name) {
    case AUTO_VIDEO_CAPTURE_NAME:
      return "Screen Recording";
    case AUTO_SCREENSHOT_CAPTURE_NAME:
      return timestamp ? `Screenshot at ${timestampToString(timestamp)}` : "Screenshot";
    default:
      return name;
  }
};

const timestampToString = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    fractionalSecondDigits: 3,
  });
};

const createAttachmentFileFactoryFn =
  (attachmentsDir: string): AttachmentFileFactory =>
  async (attachmentUuid, uniqueFileName) => {
    const fileExtension = path.extname(uniqueFileName);
    const attachmentFilePath = path.join(attachmentsDir, attachmentUuid);

    const [firstAttemptOk, firstAttemptResult] = await tryReadFile(attachmentFilePath, uniqueFileName);
    if (firstAttemptOk) {
      return firstAttemptResult;
    }

    const errors: unknown[] = [firstAttemptResult];

    if ((firstAttemptResult as any)?.code === "ENOENT" && fileExtension) {
      const attachmentPathWithExt = `${attachmentFilePath}${fileExtension}`;
      const [secondAttemptOk, secondAttemptResult] = await tryReadFile(attachmentPathWithExt, uniqueFileName);

      if (secondAttemptOk) {
        return secondAttemptResult;
      }

      errors.push(secondAttemptResult);
    }

    console.error("Can't read attachment", attachmentUuid, "in", attachmentsDir, ":", ...errors);
  };

const tryReadFile = async (
  attachmentPath: string,
  attachmentName: string,
): Promise<[true, BufferResultFile] | [false, unknown]> => {
  try {
    return [true, new BufferResultFile(await readFile(attachmentPath), attachmentName)];
  } catch (e) {
    return [false, e];
  }
};
