import type { Readable } from "node:stream";

export interface ResultFile {
  // TODO: figure out, why we can't use node types in the core
  readContent: <T>(transform: (stream: Readable) => Promise<T | undefined>) => Promise<T | undefined>;
  getOriginalFileName: () => string;
  getExtension: () => string;
  getContentType: () => string | undefined;
  getContentLength: () => number | undefined;
  asJson: <T>() => Promise<T | undefined>;
  asUtf8String: () => Promise<string | undefined>;
  asBuffer: () => Promise<Buffer | undefined>;
  writeTo: (path: string) => Promise<void>;
}
