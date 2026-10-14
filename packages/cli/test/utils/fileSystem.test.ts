import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findFilesByGlobs } from "../../src/utils/fileSystem.js";

let tmp: string;

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-utils");
  await story("fileSystem");
  await label("coverage", "cli-utils");
  tmp = await realpath(await mkdtemp(join(tmpdir(), "allure-fs-")));
  await mkdir(join(tmp, "report"));
  await writeFile(join(tmp, "report", "input.log"), "x");
  await writeFile(join(tmp, "report", ".hidden.log"), "x");
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("findFilesByGlobs", () => {
  it("matches dot files by default", async () => {
    const files = await findFilesByGlobs(tmp, ["report/*.log"]);

    expect(files.sort()).toEqual([join(tmp, "report", ".hidden.log"), join(tmp, "report", "input.log")]);
  });

  it("skips dot files when dot is disabled, like the core does for global attachments", async () => {
    const files = await findFilesByGlobs(tmp, ["report/*.log"], { dot: false, windowsPathsNoEscape: false });

    expect(files).toEqual([join(tmp, "report", "input.log")]);
  });
});
