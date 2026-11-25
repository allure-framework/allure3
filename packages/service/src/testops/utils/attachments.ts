import type { AttachmentLink, TestStepResult } from "@allurereport/core-api";

import type { UploadAttachmentDto } from "../model.js";

export const uploadFilenameForLink = (link: AttachmentLink): string | undefined => {
  if ("originalFileName" in link && typeof link.originalFileName === "string") return link.originalFileName;
  return undefined;
};

export const toUploadAttachmentDto = (link: AttachmentLink): UploadAttachmentDto => ({
  name: "name" in link && typeof link.name === "string" ? link.name : undefined,
  originalFileName: uploadFilenameForLink(link),
  contentType: "contentType" in link && typeof link.contentType === "string" ? link.contentType : undefined,
  contentLength: "contentLength" in link && typeof link.contentLength === "number" ? link.contentLength : undefined,
  optional:
    "optional" in link && typeof (link as { optional?: unknown }).optional === "boolean"
      ? (link as { optional: boolean }).optional
      : undefined,
});

export const getAttachmentIdsFromTestStepsResults = (steps: TestStepResult[] | undefined): Set<string> => {
  const ids = new Set<string>();

  for (const step of steps ?? []) {
    if (step.type === "attachment") {
      ids.add(step.link.id);
    } else {
      for (const id of getAttachmentIdsFromTestStepsResults(step.steps)) ids.add(id);
    }
  }

  return ids;
};
