import { createReadStream } from "node:fs";
import { posix } from "node:path";
import { pipeline } from "node:stream/promises";

import { extract } from "tar-stream";

import type { ReportFiles } from "./plugin.js";

export type ReportStaticManifest = Record<string, string>;

export type ReportStaticAssets = {
  manifest: ReportStaticManifest;
  featureAssets?: ReportFeatureAssets;
  files: ReadonlyMap<string, Buffer>;
};

export type ReportFeatureAssets = {
  // Schema version shared by the build plugin and archive reader.
  version: 1;
  initial: string[];
  base: string[];
  features: Record<string, string[]>;
};

const parseFeatureAssets = (
  content: Buffer,
  files: ReadonlyMap<string, Buffer>,
  mainJs: string,
): ReportFeatureAssets => {
  let value: unknown;
  try {
    value = JSON.parse(content.toString("utf8"));
  } catch (error) {
    throw new Error("The report static archive contains an invalid feature-assets.json", { cause: error });
  }
  const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
    !!candidate && typeof candidate === "object" && !Array.isArray(candidate);
  const isExistingFileList = (candidate: unknown): candidate is string[] =>
    Array.isArray(candidate) && candidate.every((file) => typeof file === "string" && files.has(file));
  if (!isRecord(value)) {
    throw new Error("Invalid report feature-assets.json: expected an object");
  }
  if (value.version !== 1) {
    throw new Error(`Unsupported report feature-assets.json version: ${JSON.stringify(value.version)}; expected 1`);
  }
  if (
    !isExistingFileList(value.initial) ||
    !isExistingFileList(value.base) ||
    !isRecord(value.features) ||
    !Object.entries(value.features).every(([key, refs]) => key.length > 0 && isExistingFileList(refs))
  ) {
    throw new Error("Invalid report feature-assets.json or missing referenced asset");
  }
  const result = value as ReportFeatureAssets;
  if (!result.initial.includes(mainJs) || !result.initial.every((file) => result.base.includes(file))) {
    throw new Error("Initial report assets must include main.js and belong to the base set");
  }
  const classified = new Set([...result.base, ...Object.values(result.features).flat()]);
  for (const file of files.keys()) {
    if (!classified.has(file)) throw new Error(`Unclassified report feature asset: ${file}`);
  }
  return result;
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

  const featureContent = files.get("feature-assets.json");
  // Archives without feature metadata retain the full asset set.
  // Present metadata must be valid before assets can be selected.
  if (!featureContent) return { manifest, files };

  // Build metadata is retained in the package archive, not published as a report asset.
  files.delete("feature-assets.json");
  for (const [key, file] of Object.entries(manifest)) {
    if (file === "feature-assets.json") delete manifest[key];
  }
  const featureAssets = parseFeatureAssets(featureContent, files, manifest["main.js"]);
  return { manifest, files, featureAssets };
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

export { createSingleFileScripts } from "./singleFileAssets.js";

export const selectReportStaticFiles = (
  assets: ReportStaticAssets,
  requiredFeatures?: readonly string[],
): ReadonlyMap<string, Buffer> => {
  const graph = assets.featureAssets;
  // Undefined means requirements are unknown (including live runs); [] selects only base assets.
  // Unknown feature IDs retain the full archive rather than risk omitting a dependency.
  if (!graph || !requiredFeatures || requiredFeatures.some((key) => !Object.hasOwn(graph.features, key))) {
    return assets.files;
  }
  const selected = new Set([...graph.base, ...requiredFeatures.flatMap((key) => graph.features[key])]);
  return new Map([...assets.files].filter(([file]) => selected.has(file)));
};
