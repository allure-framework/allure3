import type { AllureCheckResult } from "@allurereport/core-api";
import type { ResultFile } from "@allurereport/plugin-api";

import type { RawFixtureResult, RawGlobals, RawMetadata, RawTestResult } from "./model.js";

export interface ReaderContext {
  readerId: string;
  metadata?: RawMetadata;
}

export interface ResultsVisitor {
  visitTestResult(result: RawTestResult, context: ReaderContext): Promise<void>;
  visitCheckResult(result: AllureCheckResult, context: ReaderContext): Promise<void>;
  visitTestFixtureResult(result: RawFixtureResult, context: ReaderContext): Promise<void>;
  visitAttachmentFile(result: ResultFile, context: ReaderContext): Promise<void>;
  visitMetadata(metadata: RawMetadata, context: ReaderContext): Promise<void>;
  visitGlobals(globals: RawGlobals, context: ReaderContext): Promise<void>;
}

export interface ResultsReader {
  matches?(data: ResultFile): boolean | Promise<boolean>;
  read(visitor: ResultsVisitor, data: ResultFile): Promise<boolean>;
  readerId(): string;
}
