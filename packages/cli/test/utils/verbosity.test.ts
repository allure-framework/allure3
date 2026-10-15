import { getGlobalLogLevel } from "@allurereport/cli-commons";
import { UsageError } from "clipanion";
import { afterEach, describe, expect, it } from "vitest";

import { applyVerbosity, extractVerbosityFlags, isQuiet } from "../../src/utils/verbosity.js";

describe("extractVerbosityFlags", () => {
  it("returns arguments untouched when no flags are present", () => {
    expect(extractVerbosityFlags(["run", "--", "npm", "test"])).toEqual({
      args: ["run", "--", "npm", "test"],
      verbosity: "normal",
    });
  });

  it.each([
    ["--verbose", "verbose"],
    ["-v", "verbose"],
    ["--quiet", "quiet"],
    ["-q", "quiet"],
  ])("extracts %s from anywhere before the separator", (flag, verbosity) => {
    expect(extractVerbosityFlags([flag, "run", "--silent"])).toEqual({ args: ["run", "--silent"], verbosity });
    expect(extractVerbosityFlags(["run", flag, "--silent"])).toEqual({ args: ["run", "--silent"], verbosity });
  });

  it("never touches arguments of the nested command", () => {
    expect(extractVerbosityFlags(["run", "-q", "--", "pytest", "-v", "-q", "--verbose"])).toEqual({
      args: ["run", "--", "pytest", "-v", "-q", "--verbose"],
      verbosity: "quiet",
    });
  });

  it("accepts repeated flags and keeps -v for commands other than a lone version request", () => {
    expect(extractVerbosityFlags(["-v", "-v", "generate", "-v"])).toEqual({
      args: ["generate"],
      verbosity: "verbose",
    });
    expect(extractVerbosityFlags(["-v", "--version"])).toEqual({ args: ["--version"], verbosity: "verbose" });
  });

  it("keeps a lone -v for the version command", () => {
    expect(extractVerbosityFlags(["-v"])).toEqual({ args: ["-v"], verbosity: "normal" });
  });

  it("rejects --verbose together with --quiet", () => {
    expect(() => extractVerbosityFlags(["run", "-v", "-q"])).toThrow(UsageError);
  });
});

describe("applyVerbosity", () => {
  afterEach(() => applyVerbosity("normal"));

  it("maps verbose to the verbose log level", () => {
    applyVerbosity("verbose");

    expect(getGlobalLogLevel()).toBe("verbose");
    expect(isQuiet()).toBe(false);
  });

  it("maps quiet to the error log level", () => {
    applyVerbosity("quiet");

    expect(getGlobalLogLevel()).toBe("error");
    expect(isQuiet()).toBe(true);
  });

  it("resets to the environment-driven level for normal", () => {
    applyVerbosity("quiet");
    applyVerbosity("normal");

    expect(getGlobalLogLevel()).toBeUndefined();
  });
});
