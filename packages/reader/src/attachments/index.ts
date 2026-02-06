import type { ResultsReader } from "@allurereport/reader-api";

const readerId = "attachments";

export const attachments: ResultsReader = {
  read: async (visitor, data) => {
    await visitor.visitAttachmentFile(data, { readerId });

    return true;
  },
  readerId: () => readerId,
};
