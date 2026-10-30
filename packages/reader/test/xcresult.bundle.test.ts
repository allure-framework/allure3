import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mdlsOutput = vi.hoisted(() => ({ lines: [] as string[] }));

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  platform: () => "darwin",
}));

vi.mock("@allurereport/reader-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/reader-api")>()),
  invokeStdoutCliTool: async function* () {
    yield* mdlsOutput.lines;
  },
}));

const { isXcResultBundle } = await import("../src/xcresult/bundle.js");

beforeEach(async () => {
  await epic("coverage");
  await feature("reading");
  await story("xcresult.bundle");
  await label("coverage", "reading");
});

describe("isXcResultBundle on Mac OS", () => {
  it("should detect an indexed bundle by its uniform type identifier", async () => {
    mdlsOutput.lines = ["(", '    "com.apple.xcode.resultbundle",', '    "public.folder"', ")"];

    expect(await isXcResultBundle("/results/bundle")).toBe(true);
  });

  it("should detect an indexed .xcresult bundle reported as a plain folder when Xcode is missing", async () => {
    mdlsOutput.lines = ["(", '    "public.folder",', '    "public.directory",', '    "public.item"', ")"];

    expect(await isXcResultBundle("/results/passed.xcresult")).toBe(true);
  });

  it("should detect an indexed bundle with an Info.plist reported as a plain folder when Xcode is missing", async () => {
    mdlsOutput.lines = ["(", '    "public.folder",', '    "public.directory",', '    "public.item"', ")"];
    const directory = path.join(await mkdtemp(path.join(tmpdir(), "allure-reader-bundle-")), "results");
    await mkdir(directory);
    await writeFile(path.join(directory, "Info.plist"), "plist", "utf-8");

    try {
      expect(await isXcResultBundle(directory)).toBe(true);
    } finally {
      await rm(path.dirname(directory), { recursive: true, force: true });
    }
  });

  it("should not treat an indexed plain folder as a bundle", async () => {
    mdlsOutput.lines = ["(", '    "public.folder",', '    "public.directory",', '    "public.item"', ")"];

    expect(await isXcResultBundle("/results/allure-results")).toBe(false);
  });
});
