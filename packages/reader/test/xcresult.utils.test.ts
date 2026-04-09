import console from "node:console";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { findBundleInfoFile, followsXcResultNaming, isMostProbablyXcResultBundle } from "../src/xcresult/bundle.js";
import { createAttachmentFileFactory, mapWellKnownAttachmentName } from "../src/xcresult/xcresulttool/utils.js";

describe("xcresult bundle helpers", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map(async (directory) => {
        await import("node:fs/promises").then(({ rm }) => rm(directory, { recursive: true, force: true }));
      }),
    );
    tempDirs.length = 0;
  });

  const createTempDir = async (name: string) => {
    const parent = await mkdtemp(path.join(tmpdir(), "allure-reader-bundle-"));
    const directory = path.join(parent, name);
    await mkdir(directory, { recursive: true });
    tempDirs.push(directory);
    return directory;
  };

  it("should detect xcresult bundles by naming convention and bundle metadata", async () => {
    const namedBundle = await createTempDir("named.xcresult");
    const bundleWithInfo = await createTempDir("bundle");
    const plainDirectory = await createTempDir("plain");

    await mkdir(path.join(bundleWithInfo, "Contents"), { recursive: true });
    await writeFile(path.join(bundleWithInfo, "Contents", "Info.plist"), "plist", "utf-8");

    expect(followsXcResultNaming(namedBundle)).toBe(true);
    expect(await findBundleInfoFile(bundleWithInfo)).toBe(path.join(bundleWithInfo, "Contents", "Info.plist"));
    expect(await isMostProbablyXcResultBundle(namedBundle)).toBe(true);
    expect(await isMostProbablyXcResultBundle(bundleWithInfo)).toBe(true);
    expect(await isMostProbablyXcResultBundle(plainDirectory)).toBe(false);
  });
});

describe("xcresult attachment helpers", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map(async (directory) => {
        await import("node:fs/promises").then(({ rm }) => rm(directory, { recursive: true, force: true }));
      }),
    );
    tempDirs.length = 0;
    vi.restoreAllMocks();
  });

  const createTempDir = async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "allure-reader-attachments-"));
    tempDirs.push(directory);
    return directory;
  };

  it("should read exported attachments by exact file path and extension fallback", async () => {
    const attachmentsDir = await createTempDir();
    const factory = createAttachmentFileFactory(attachmentsDir);

    await writeFile(path.join(attachmentsDir, "uuid-plain"), "plain text", "utf-8");
    await writeFile(path.join(attachmentsDir, "uuid-image.png"), "png data", "utf-8");

    const plain = await factory("uuid-plain", "plain.txt");
    const image = await factory("uuid-image", "image.png");

    expect(plain?.getOriginalFileName()).toBe("plain.txt");
    expect(await plain?.asUtf8String()).toBe("plain text");
    expect(image?.getOriginalFileName()).toBe("image.png");
    expect(await image?.asUtf8String()).toBe("png data");
  });

  it("should return undefined and log an actionable error when an attachment cannot be read", async () => {
    const attachmentsDir = await createTempDir();
    const factory = createAttachmentFileFactory(attachmentsDir);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(factory("missing-uuid", "missing.txt")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Can't read attachment",
      "missing-uuid",
      "in",
      attachmentsDir,
      ":",
      expect.anything(),
      expect.anything(),
    );
  });

  it("should map well-known automatic attachment names to readable titles", () => {
    expect(mapWellKnownAttachmentName("kXCTAttachmentScreenRecording", undefined)).toBe("Screen Recording");
    expect(mapWellKnownAttachmentName("kXCTAttachmentLegacyScreenImageData", undefined)).toBe("Screenshot");
    expect(mapWellKnownAttachmentName("kXCTAttachmentLegacyScreenImageData", 1_717_171_717_171)).toContain(
      "Screenshot at",
    );
    expect(mapWellKnownAttachmentName("Custom Attachment", undefined)).toBe("Custom Attachment");
  });
});
