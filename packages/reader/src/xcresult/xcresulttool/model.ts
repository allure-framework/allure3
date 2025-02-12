import type { ResultFile } from "@allurereport/plugin-api";
import type { RawTestResult } from "@allurereport/reader-api";

export type ParsingState = {
  suites: readonly string[];
  bundle?: string;
};

export type ParsingContext = {
  xcResultPath: string;
  createAttachmentFile: AttachmentFileFactory;
};

export type AttachmentFileFactory = (attachmentUuid: string, uniqueFileName: string) => Promise<ResultFile | undefined>;

export type ApiParseFunction = (context: ParsingContext) => AsyncGenerator<ResultFile | RawTestResult, void, unknown>;
