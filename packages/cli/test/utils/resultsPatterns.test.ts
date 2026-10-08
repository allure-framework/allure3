import { describe, expect, it } from "vitest";

import {
  normalizeResultsDir,
  normalizeResultsDirectoryPath,
  parseRunCommand,
  resolveResultsPatterns,
} from "../../src/utils/resultsPatterns.js";

describe("normalizeResultsDir", () => {
  it("returns empty for undefined, empty string, and empty array", () => {
    expect(normalizeResultsDir(undefined)).toEqual([]);
    expect(normalizeResultsDir("")).toEqual([]);
    expect(normalizeResultsDir([])).toEqual([]);
    expect(normalizeResultsDir(["", ""])).toEqual([]);
  });

  it("preserves whitespace-only and spaced paths; drops only empty string", () => {
    expect(normalizeResultsDir("   ")).toEqual(["   "]);
    expect(normalizeResultsDir("./a")).toEqual(["./a"]);
    expect(normalizeResultsDir([" ./a ", "./b"])).toEqual([" ./a ", "./b"]);
    expect(normalizeResultsDir(["", "  "])).toEqual(["  "]);
  });
});

describe("resolveResultsPatterns", () => {
  it("prefers non-empty CLI over config", () => {
    expect(resolveResultsPatterns(["./cli"], ["./config"])).toEqual(["./cli"]);
  });

  it("falls back to config when CLI empty", () => {
    expect(resolveResultsPatterns([], ["./config"])).toEqual(["./config"]);
    expect(resolveResultsPatterns([""], "./config")).toEqual(["./config"]);
  });

  it("returns empty when both unset", () => {
    expect(resolveResultsPatterns([], undefined)).toEqual([]);
    expect(resolveResultsPatterns([], [])).toEqual([]);
  });
});

describe("normalizeResultsDirectoryPath", () => {
  it("strips trailing separators for stable set diffs", () => {
    const a = normalizeResultsDirectoryPath("/tmp/results/");
    const b = normalizeResultsDirectoryPath("/tmp/results");

    expect(a).toBe(b);
  });
});

describe("parseRunCommand", () => {
  it("parses command after optional --", () => {
    expect(parseRunCommand(["--", "npm", "test"])).toEqual({
      command: "npm",
      commandArgs: ["test"],
    });
  });

  it("keeps nested -- inside the command", () => {
    expect(parseRunCommand(["npm", "test", "--", "--grep", "foo"])).toEqual({
      command: "npm",
      commandArgs: ["test", "--", "--grep", "foo"],
    });
  });

  it("treats path-like executables as the command", () => {
    expect(parseRunCommand(["./script.sh", "--flag"])).toEqual({
      command: "./script.sh",
      commandArgs: ["--flag"],
    });
  });

  it("returns undefined command when empty", () => {
    expect(parseRunCommand([])).toEqual({
      command: undefined,
      commandArgs: [],
    });
    expect(parseRunCommand(["--"])).toEqual({
      command: undefined,
      commandArgs: [],
    });
  });
});
