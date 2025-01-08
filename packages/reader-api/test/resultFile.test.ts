import { extension } from "mime-types";
import { describe, expect, it } from "vitest";
import { BufferResultFile, PathResultFile } from "../src/index.js";
import { buildResourcePath, readResource, resources } from "./utils.js";

describe("BufferResultFile", () => {
  it.each(resources)("should detect type %s as %s by magic header", async (resource, expectedType) => {
    const buffer = await readResource(resource);
    const resultFile = new BufferResultFile(buffer, "without-extension");

    const result = resultFile.getContentType();
    expect(result).toEqual(expectedType);
  });

  it.each(resources)("should detect type %s as %s by file extension with higher priority", async (resource) => {
    const buffer = await readResource(resource);
    const resultFile = new BufferResultFile(buffer, "with-extension.mp4");

    const result = resultFile.getContentType();
    expect(result).toEqual("video/mp4");
  });

  it.each(resources)(
    "should return extension according to detected type %s as %s by magic header",
    async (resource, expectedType) => {
      const buffer = await readResource(resource);
      const resultFile = new BufferResultFile(buffer, "without-extension");

      const result = resultFile.getExtension();
      expect(result).toEqual(`.${extension(expectedType)}`);
    },
  );

  it.each(resources)("should preserve extension ignoring detected type %s as %s by magic header", async (resource) => {
    const buffer = await readResource(resource);
    const resultFile = new BufferResultFile(buffer, "with-extension.mp4");

    const result = resultFile.getExtension();
    expect(result).toEqual(".mp4");
  });
});

describe("PathResultFile", () => {
  it.each(resources)("should detect type %s as %s by magic header", async (resource, expectedType) => {
    const path = buildResourcePath(resource);
    const resultFile = new PathResultFile(path, "without-extension");

    const result = resultFile.getContentType();
    expect(result).toEqual(expectedType);
  });

  it.each(resources)("should detect type %s as %s by file extension with higher priority", async (resource) => {
    const path = buildResourcePath(resource);
    const resultFile = new PathResultFile(path, "with-extension.mp4");

    const result = resultFile.getContentType();
    expect(result).toEqual("video/mp4");
  });

  it.each(resources)(
    "should return extension according to detected type %s as %s by magic header",
    async (resource, expectedType) => {
      const path = buildResourcePath(resource);
      const resultFile = new PathResultFile(path, "without-extension");

      const result = resultFile.getExtension();
      expect(result).toEqual(`.${extension(expectedType)}`);
    },
  );

  it.each(resources)("should preserve extension ignoring detected type %s as %s by magic header", async (resource) => {
    const path = buildResourcePath(resource);
    const resultFile = new PathResultFile(path, "with-extension.mp4");

    const result = resultFile.getExtension();
    expect(result).toEqual(".mp4");
  });
});
