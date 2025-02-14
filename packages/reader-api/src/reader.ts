import type { ResultFile } from "@allurereport/plugin-api";
import { stat } from "node:fs/promises";
import type { RawFixtureResult, RawMetadata, RawTestResult } from "./model.js";
import { PathResultFile } from "./resultFile.js";

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
  read(visitor: ResultsVisitor, path: string): Promise<boolean>;
  readerId(): string;
}

export abstract class ResultsReaderBase implements ResultsReader {
  #readerId: string;

  constructor(readerId: string) {
    this.#readerId = readerId;
  }

  readerId() {
    return this.#readerId;
  }

  abstract read(visitor: ResultsVisitor, resultPath: string): Promise<boolean>;
}

export abstract class FileResultsReader extends ResultsReaderBase {
  override async read(visitor: ResultsVisitor, resultPath: string): Promise<boolean> {
    const pathMeta = await stat(resultPath);

    if (pathMeta.isFile()) {
      return await this.readFile(visitor, new PathResultFile(resultPath));
    }

    return false;
  }

  abstract readFile(visitor: ResultsVisitor, data: ResultFile): Promise<boolean>;
}

export abstract class DirectoryResultsReader extends ResultsReaderBase {
  override async read(visitor: ResultsVisitor, resultDir: string): Promise<boolean> {
    const pathMeta = await stat(resultDir);

    if (pathMeta.isDirectory()) {
      return await this.readDirectory(visitor, resultDir);
    }

    return false;
  }

  abstract readDirectory(visitor: ResultsVisitor, path: string): Promise<boolean>;
}
