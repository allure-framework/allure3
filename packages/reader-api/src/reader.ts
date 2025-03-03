import type { ResultFile } from "@allurereport/core-api";
import type { RawFixtureResult, RawMetadata, RawTestResult } from "./model.js";

export interface ReaderContext {
  readerId: string;
  metadata?: RawMetadata;
}

export interface ResultsVisitor {
  visitTestResult(result: RawTestResult, context: ReaderContext): Promise<void>;
  visitTestFixtureResult(result: RawFixtureResult, context: ReaderContext): Promise<void>;
  visitAttachmentFile(result: ResultFile, context: ReaderContext): Promise<void>;
  visitMetadata(metadata: RawMetadata, context: ReaderContext): Promise<void>;
}

export interface ResultsReader {
  read(visitor: ResultsVisitor, data: ResultFile): Promise<boolean>;
  readerId(): string;
}
