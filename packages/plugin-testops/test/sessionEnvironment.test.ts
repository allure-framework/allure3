import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { toSessionVariables } from "../src/utils/sessionEnvironment.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("sessionEnvironment");
  await label("coverage", "testops-integration");
});

describe("toSessionVariables", () => {
  it("should drop variables that aren't strings, numbers or booleans", () => {
    expect(toSessionVariables({ Matrix: { os: "linux" }, List: ["a", "b"], Browser: "chrome" })).toEqual({
      Browser: "chrome",
    });
  });

  it("should drop variables with an empty value", () => {
    expect(toSessionVariables({ Stand: "", Region: "  ", Browser: "chrome" })).toEqual({ Browser: "chrome" });
  });

  it("should drop variables without a value and stringify the rest", () => {
    expect(toSessionVariables({ Stand: undefined, Region: null, Shard: 3, Debug: false, Browser: "chrome" })).toEqual({
      Shard: "3",
      Debug: "false",
      Browser: "chrome",
    });
  });
});
