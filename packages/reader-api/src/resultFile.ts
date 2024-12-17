import type { ResultFile } from "@allurereport/plugin-api";
import { lookup } from "mime-types";
import { ReadStream, createReadStream, createWriteStream, existsSync, statSync } from "node:fs";
import "node:fs/promises";
import { basename } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export abstract class BaseResultFile implements ResultFile {
  fileName: string;

  protected constructor(fileName: string) {
    this.fileName = fileName;
  }

  protected abstract getContent(): ReadStream | undefined;

  abstract getContentLength(): number | undefined;

  // TODO rework content type detection based on magic bytes as well
  getContentType(): string | undefined {
    const res = lookup(this.getOriginalFileName());
    if (res === false) {
      return undefined;
    }
    return res;
  }

  getOriginalFileName(): string {
    return this.fileName;
  }

  async asJson<T>(): Promise<T | undefined> {
    return await this.readContent<T>(readSteamToJson);
  }

  async asUtf8String(): Promise<string | undefined> {
    return await this.readContent(readStreamToString);
  }

  async asBuffer(): Promise<Buffer | undefined> {
    return await this.readContent(readStreamToBuffer);
  }

  async writeTo(path: string): Promise<void> {
    await this.readContent(async (stream) => {
      await pipeline(stream, createWriteStream(path));
    });
  }

  async readContent<T>(transform: (stream: ReadStream) => Promise<T | undefined>): Promise<T | undefined> {
    const content = this.getContent();
    return content ? await transform(content) : undefined;
  }
}

export class BufferResultFile extends BaseResultFile {
  buffer: Buffer;

  constructor(buffer: Buffer, fileName: string) {
    // basename used as an protection against complex paths
    super(basename(fileName));
    this.buffer = buffer;
  }

  protected getContent(): ReadStream | undefined {
    return ReadStream.from(this.buffer, { encoding: "utf8" }) as ReadStream;
  }

  getContentLength(): number | undefined {
    return this.buffer.length;
  }
}

export class PathResultFile extends BaseResultFile {
  path: string;

  constructor(path: string, fileName: string = basename(path)) {
    super(fileName);
    this.path = path;
  }

  protected getContent(): ReadStream | undefined {
    if (existsSync(this.path)) {
      return createReadStream(this.path);
    } else {
      return undefined;
    }
  }

  getContentLength(): number | undefined {
    return statSync(this.path, { throwIfNoEntry: false })?.size;
  }
}

export const readSteamToJson = async <T>(stream: Readable): Promise<T | undefined> => {
  const text = await readStreamToString(stream);
  return JSON.parse(text);
};

export const readStreamToString = async (stream: Readable): Promise<string> => {
  const res = await readStreamToBuffer(stream);
  return res.toString("utf-8");
};

export const readStreamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};
