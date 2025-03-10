import type { ResultFile } from "@allurereport/plugin-api";
import { lookup } from "mime-types";
import {
  ReadStream,
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  openSync,
  readSync,
  statSync,
} from "node:fs";
import "node:fs/promises";
import { basename } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { detectContentType } from "./detect.js";
import { extension } from "./utils.js";

export abstract class BaseResultFile implements ResultFile {
  fileName: string;
  extension: string | false = false;
  contentType: string | undefined | false = false;

  protected constructor(fileName: string) {
    this.fileName = fileName;
  }

  protected abstract getContent(): ReadStream | undefined;

  protected abstract readMagicHeader(): Uint8Array | undefined;

  abstract getContentLength(): number | undefined;

  getContentType(): string | undefined {
    if (this.contentType === false) {
      this.contentType = this.#detectContentType();
    }
    return this.contentType;
  }

  #detectContentType() {
    const res = lookup(this.getOriginalFileName());
    if (res === false) {
      const magicHeader = this.readMagicHeader();
      if (!magicHeader) {
        return undefined;
      }
      return detectContentType(magicHeader);
    }
    return res;
  }

  getOriginalFileName(): string {
    return this.fileName;
  }

  getExtension(): string {
    if (this.extension === false) {
      this.extension = extension(this.getOriginalFileName()) ?? extension("", this.getContentType()) ?? "";
    }
    return this.extension;
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

// so far maximum offset is 512 for supported files
const magicHeaderLength = 1024;

export class BufferResultFile extends BaseResultFile {
  buffer: Uint8Array;

  constructor(buffer: Uint8Array, fileName: string) {
    // basename used as an protection against complex paths
    super(basename(fileName));
    this.buffer = buffer;
  }

  protected getContent(): ReadStream {
    return ReadStream.from(this.buffer) as ReadStream;
  }

  protected readMagicHeader(): Uint8Array {
    return this.buffer.subarray(0, magicHeaderLength);
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

  protected readMagicHeader(): Uint8Array | undefined {
    if (existsSync(this.path)) {
      const buf = new Uint8Array(magicHeaderLength);
      const fd = openSync(this.path, "r");
      try {
        const size = readSync(fd, buf, 0, magicHeaderLength, null);
        if (size === 0) {
          return undefined;
        }
        if (size < magicHeaderLength) {
          return buf.subarray(0, size);
        }
        return buf;
      } finally {
        closeSync(fd);
      }
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
