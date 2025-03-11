import type { ResultFile } from "@allurereport/plugin-api";
import type { RawTestResult } from "@allurereport/reader-api";

export abstract class XcresultParser {
  protected readonly xcResultPath: string;
  protected readonly createAttachmentFile: AttachmentFileFactory | undefined;

  constructor(options: ParsingOptions) {
    this.xcResultPath = options.xcResultPath;
    this.createAttachmentFile = options.createAttachmentFile;
  }

  abstract parse(): AsyncGenerator<ResultFile | RawTestResult, void, unknown>;
}

export type ParsingState = {
  suites: readonly string[];
  bundle?: string;
};

export type ParsingOptions = {
  xcResultPath: string;
  createAttachmentFile?: AttachmentFileFactory;
};

export type AttachmentFileFactory = (attachmentUuid: string, uniqueFileName: string) => Promise<ResultFile | undefined>;
