import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, parse } from "node:path";
import { cwd as processCwd } from "node:process";

import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanOutputDirectory, getUnsafeCleanReason } from "../../src/utils/cleanOutput.js";

let tmp: string;

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-utils");
  await story("cleanOutput");
  await label("coverage", "cli-utils");
  tmp = await mkdtemp(join(tmpdir(), "allure-clean-"));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("getUnsafeCleanReason", () => {
  it("allows a regular output directory", () => {
    expect(
      getUnsafeCleanReason({ output: "allure-report", cwd: tmp, resultsDirs: [join(tmp, "allure-results")] }),
    ).toBe(undefined);
  });

  it("refuses a filesystem root", () => {
    expect(getUnsafeCleanReason({ output: parse(tmp).root, cwd: tmp })).toMatch(/root/);
  });

  it("refuses the working directory and its ancestors", () => {
    expect(getUnsafeCleanReason({ output: ".", cwd: tmp })).toMatch(/working directory/);
    expect(getUnsafeCleanReason({ output: join(tmp, ".."), cwd: tmp })).toMatch(/working directory/);
  });

  it("refuses the process working directory even when --cwd points elsewhere", () => {
    expect(getUnsafeCleanReason({ output: processCwd(), cwd: tmp })).toMatch(/working directory/);
  });

  it("refuses the home directory and its ancestors", () => {
    expect(getUnsafeCleanReason({ output: homedir(), cwd: tmp })).toMatch(/home|working directory/);
  });

  it("refuses the results directory, its ancestors and descendants", () => {
    const results = join(tmp, "a", "results");
    const cwd = join(tmp, "work");

    expect(getUnsafeCleanReason({ output: results, cwd, resultsDirs: [results] })).toMatch(/results directory/);
    expect(getUnsafeCleanReason({ output: join(tmp, "a"), cwd, resultsDirs: [results] })).toMatch(/results directory/);
    expect(getUnsafeCleanReason({ output: join(results, "report"), cwd, resultsDirs: [results] })).toMatch(
      /inside the results directory/,
    );
  });

  it("refuses a directory that contains a dump file", () => {
    expect(
      getUnsafeCleanReason({
        output: join(tmp, "out"),
        cwd: join(tmp, "work"),
        inputFiles: [join(tmp, "out", "d.zip")],
      }),
    ).toMatch(/input file/);
  });
});

describe("cleanOutputDirectory", () => {
  it("removes an existing directory with its content", async () => {
    const cwd = join(tmp, "work");
    const out = join(tmp, "report");

    await mkdir(join(out, "nested"), { recursive: true });
    await writeFile(join(out, "nested", "stale.txt"), "x");
    await cleanOutputDirectory({ output: out, cwd });

    expect(existsSync(out)).toBe(false);
  });

  it("does not fail when the directory is missing", async () => {
    await expect(
      cleanOutputDirectory({ output: join(tmp, "missing"), cwd: join(tmp, "work") }),
    ).resolves.toBeUndefined();
  });

  it("throws and keeps files for an unsafe path", async () => {
    await writeFile(join(tmp, "keep.txt"), "x");

    await expect(cleanOutputDirectory({ output: tmp, cwd: tmp })).rejects.toThrow(/Refusing to clean/);
    expect(existsSync(join(tmp, "keep.txt"))).toBe(true);
  });
});
