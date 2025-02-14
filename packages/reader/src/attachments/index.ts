import type { ResultFile } from "@allurereport/plugin-api";
import type { ResultsVisitor } from "@allurereport/reader-api";
import { FileResultsReader } from "@allurereport/reader-api";

class AttachmentsReader extends FileResultsReader {
  constructor() {
    super("attachments");
  }
  override async readFile(visitor: ResultsVisitor, data: ResultFile) {
    await visitor.visitAttachmentFile(data, { readerId: this.readerId() });
    return true;
  }
}

export const attachments = new AttachmentsReader();
