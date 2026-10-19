import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { hasOwnVariables, toSessionVariables } from "../src/utils/sessionEnvironment.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("sessionEnvironment");
  await label("coverage", "testops-integration");
});

describe("toSessionVariables", () => {
  it("should drop variables without a value and stringify the rest", () => {
    expect(toSessionVariables({ Stand: undefined, Region: null, Shard: 3, Debug: false, Browser: "chrome" })).toEqual({
      Shard: "3",
      Debug: "false",
      Browser: "chrome",
    });
  });
});

describe("hasOwnVariables", () => {
  it("should be true when an environment overrides a report variable", () => {
    expect(hasOwnVariables({ browser: "x" }, { browser: "y" })).toBe(true);
  });

  it("should be true when an environment adds a variable that differs only in case", () => {
    expect(hasOwnVariables({ browser: "x" }, { browser: "x", Browser: "y" })).toBe(true);
  });

  it("should be true when an environment unsets a report variable", () => {
    expect(hasOwnVariables({ Stand: "staging" }, {})).toBe(true);
  });

  it("should be false when an environment only repeats report variables", () => {
    expect(hasOwnVariables({ Stand: "staging" }, { Stand: "staging" })).toBe(false);
  });
});
