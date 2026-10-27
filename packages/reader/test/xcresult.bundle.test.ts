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

  it("should not treat an indexed plain folder as a bundle", async () => {
    mdlsOutput.lines = ["(", '    "public.folder",', '    "public.directory",', '    "public.item"', ")"];

    expect(await isXcResultBundle("/results/allure-results")).toBe(false);
  });
});
