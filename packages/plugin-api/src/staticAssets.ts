import { createReadStream } from "node:fs";
import { posix } from "node:path";
import { pipeline } from "node:stream/promises";

import { extract } from "tar-stream";

import type { ReportFiles } from "./plugin.js";

export type ReportStaticManifest = Record<string, string>;

export type ReportStaticAssets = {
  manifest: ReportStaticManifest;
  files: ReadonlyMap<string, Buffer>;
};

const validateEntryName = (name: string) => {
  if (
    !name ||
    name.includes("\0") ||
    name.includes("\\") ||
    posix.isAbsolute(name) ||
    posix.normalize(name) !== name ||
    name === ".." ||
    name.startsWith("../")
  ) {
    throw new Error(`Unsafe report static archive entry: ${JSON.stringify(name)}`);
  }
};

const parseManifest = (content: Buffer): ReportStaticManifest => {
  let manifest: unknown;

  try {
    manifest = JSON.parse(content.toString("utf8"));
  } catch (error) {
    throw new Error("The report static archive contains an invalid manifest.json", { cause: error });
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("The report static archive manifest must be an object");
  }

  for (const [key, value] of Object.entries(manifest)) {
    if (!key || typeof value !== "string") {
      throw new Error("The report static archive manifest must map non-empty keys to file names");
    }

    validateEntryName(value);
  }

  return manifest as ReportStaticManifest;
};

export const readReportStaticAssets = async (archive: string | URL): Promise<ReportStaticAssets> => {
  const files = new Map<string, Buffer>();
  const archiveExtractor = extract();
  let archiveError: Error | undefined;

  archiveExtractor.on("entry", (header, stream, next) => {
    const skipEntry = (error: Error) => {
      archiveError ??= error;
      stream.on("end", next);
      stream.resume();
    };

    if (header.type === "directory") {
      stream.on("end", next);
      stream.resume();
      return;
    }

    if (header.type !== "file") {
      skipEntry(new Error(`Unsupported report static archive entry type: ${header.type}`));
      return;
    }

    try {
      validateEntryName(header.name);

      if (files.has(header.name)) {
        throw new Error(`Duplicate report static archive entry: ${header.name}`);
      }
    } catch (error) {
      skipEntry(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("error", (error) => archiveExtractor.destroy(error));
    stream.on("end", () => {
      files.set(header.name, Buffer.concat(chunks));
      next();
    });
  });

  await pipeline(createReadStream(archive), archiveExtractor);

  if (archiveError) {
    throw archiveError;
  }

  const manifestContent = files.get("manifest.json");

  if (!manifestContent) {
    throw new Error("The report static archive does not contain manifest.json");
  }

  files.delete("manifest.json");

  const manifest = parseManifest(manifestContent);

  if (!manifest["main.js"]) {
    throw new Error('The report static archive manifest does not contain "main.js"');
  }

  for (const fileName of Object.values(manifest)) {
    if (!files.has(fileName)) {
      throw new Error(`The report static archive does not contain manifest asset: ${fileName}`);
    }
  }

  return { manifest, files };
};

export const getReportStaticAsset = (assets: ReportStaticAssets, fileName: string): Buffer => {
  const content = assets.files.get(fileName);

  if (!content) {
    throw new Error(`The report static archive does not contain asset: ${fileName}`);
  }

  return content;
};

export const copyReportStaticAssets = async (assets: ReportStaticAssets, reportFiles: ReportFiles): Promise<void> => {
  for (const [fileName, content] of assets.files) {
    await reportFiles.addFile(fileName, content);
  }
};
