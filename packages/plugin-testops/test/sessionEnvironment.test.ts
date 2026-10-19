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
  it("should override process env by config ignoring case and keep config spelling", () => {
    expect(mergeSessionEnvironment({ BROWSER: "chrome", CI: "true" }, {}, { Browser: "firefox" })).toEqual({
      CI: "true",
      Browser: "firefox",
    });
  });

  it("should override report variables by environment variables ignoring case", () => {
    expect(mergeSessionEnvironment({}, { browser: "x", Stand: "staging" }, { Browser: "y" })).toEqual({
      Stand: "staging",
      Browser: "y",
    });
  });

  it("should override process env by report variables", () => {
    expect(mergeSessionEnvironment({ stand: "prod" }, { Stand: "staging" }, {})).toEqual({ Stand: "staging" });
  });

  it("should leave process env case duplicates untouched", () => {
    expect(mergeSessionEnvironment({ foo: "1", FOO: "2" }, {}, {})).toEqual({ foo: "1", FOO: "2" });
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
