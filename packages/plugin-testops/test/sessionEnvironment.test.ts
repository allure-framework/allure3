import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { mergeSessionEnvironment, ownEnvironmentVariables } from "../src/utils/sessionEnvironment.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("sessionEnvironment");
  await label("coverage", "testops-integration");
});

describe("mergeSessionEnvironment", () => {
  it("should override process env by config with the same key", () => {
    expect(mergeSessionEnvironment({ browser: "chrome", CI: "true" }, {}, { browser: "firefox" })).toEqual({
      CI: "true",
      browser: "firefox",
    });
  });

  it("should override report variables by environment variables with the same key", () => {
    expect(mergeSessionEnvironment({}, { browser: "x", Stand: "staging" }, { browser: "y" })).toEqual({
      Stand: "staging",
      browser: "y",
    });
  });

  it("should override process env by report variables", () => {
    expect(mergeSessionEnvironment({ Stand: "prod" }, { Stand: "staging" }, {})).toEqual({ Stand: "staging" });
  });

  it("should keep keys that differ only in case, as TestOps matches session keys case-sensitively", () => {
    expect(mergeSessionEnvironment({ BROWSER: "ci" }, { stand: "x" }, { Browser: "firefox" })).toEqual({
      BROWSER: "ci",
      stand: "x",
      Browser: "firefox",
    });
  });
});

describe("ownEnvironmentVariables", () => {
  it("should return only entries that differ from report variables", () => {
    expect(
      ownEnvironmentVariables({ Stand: "staging", browser: "x" }, { Stand: "staging", browser: "x", Browser: "y" }),
    ).toEqual({ Browser: "y" });
  });

  it("should be empty when environment only repeats report variables", () => {
    expect(ownEnvironmentVariables({ Stand: "staging" }, { Stand: "staging" })).toEqual({});
  });
});
