import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
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
  tmp = await realpath(await mkdtemp(join(tmpdir(), "allure-clean-")));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("getUnsafeCleanReason", () => {
  it("allows a regular output directory", async () => {
    const reason = await getUnsafeCleanReason({
      output: "allure-report",
      cwd: tmp,
      resultsDirs: [join(tmp, "allure-results")],
      inputs: [join(tmp, "dump.zip")],
    });

    expect(reason).toBeUndefined();
  });

  it("allows a directory whose name starts with two dots", async () => {
    expect(await getUnsafeCleanReason({ output: "..report", cwd: tmp })).toBeUndefined();
  });

  it("refuses a filesystem root", async () => {
    expect(await getUnsafeCleanReason({ output: parse(tmp).root, cwd: tmp })).toMatch(/root/);
  });

  it("refuses the working directory and its ancestors", async () => {
    expect(await getUnsafeCleanReason({ output: ".", cwd: tmp })).toMatch(/working directory/);
    expect(await getUnsafeCleanReason({ output: join(tmp, ".."), cwd: tmp })).toMatch(/working directory/);
  });

  it("refuses the process working directory even when --cwd points elsewhere", async () => {
    expect(await getUnsafeCleanReason({ output: processCwd(), cwd: tmp })).toMatch(/working directory/);
  });

  it("refuses the home directory", async () => {
    expect(await getUnsafeCleanReason({ output: homedir(), cwd: tmp })).toMatch(/home|working directory/);
  });

  it("refuses the results directory, its ancestors and descendants", async () => {
    const results = join(tmp, "a", "results");
    const cwd = join(tmp, "work");

    expect(await getUnsafeCleanReason({ output: results, cwd, resultsDirs: [results] })).toMatch(/results directory/);
    expect(await getUnsafeCleanReason({ output: join(tmp, "a"), cwd, resultsDirs: [results] })).toMatch(
      /results directory/,
    );
    expect(await getUnsafeCleanReason({ output: join(results, "report"), cwd, resultsDirs: [results] })).toMatch(
      /inside a results directory/,
    );
  });

  it("refuses a directory that contains an input file", async () => {
    const reason = await getUnsafeCleanReason({
      output: join(tmp, "out"),
      cwd: join(tmp, "work"),
      inputs: [join(tmp, "out", "history.jsonl")],
    });

    expect(reason).toMatch(/input file/);
  });

  it("sees through symlinks", async () => {
    const results = join(tmp, "results");
    const link = join(tmp, "link");

    await mkdir(results);
    await symlink(results, link);

    expect(await getUnsafeCleanReason({ output: link, cwd: join(tmp, "work"), resultsDirs: [results] })).toMatch(
      /results directory/,
    );
    expect(
      await getUnsafeCleanReason({ output: join(link, "report"), cwd: join(tmp, "work"), resultsDirs: [results] }),
    ).toMatch(/inside a results directory/);
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

  it("resolves a relative output against the working directory", async () => {
    await mkdir(join(tmp, "report"));
    await cleanOutputDirectory({ output: "report", cwd: tmp });

    expect(existsSync(join(tmp, "report"))).toBe(false);
  });

  it("does not fail when the directory is missing", async () => {
    await expect(
      cleanOutputDirectory({ output: join(tmp, "missing"), cwd: join(tmp, "work") }),
    ).resolves.toBeUndefined();
  });

  it("removes only the link when the output is a symlink to a safe directory", async () => {
    const target = join(tmp, "target");
    const link = join(tmp, "link");

    await mkdir(target);
    await writeFile(join(target, "keep.txt"), "x");
    await symlink(target, link);
    await cleanOutputDirectory({ output: link, cwd: join(tmp, "work") });

    expect(existsSync(link)).toBe(false);
    expect(existsSync(join(target, "keep.txt"))).toBe(true);
  });

  it("throws and keeps files for an unsafe path", async () => {
    await writeFile(join(tmp, "keep.txt"), "x");

    await expect(cleanOutputDirectory({ output: tmp, cwd: tmp })).rejects.toThrow(/Refusing to clean/);
    expect(existsSync(join(tmp, "keep.txt"))).toBe(true);
  });
});
