import { UsageError } from "clipanion";
import { describe, expect, it } from "vitest";

import { resolveCommandEnvironment } from "../../src/utils/environment.js";

const config = {
  environment: "qa",
  environments: {
    qa: {
      name: "Config QA",
      matcher: () => true,
    },
    prod_env: {
      name: "Production",
      matcher: () => false,
    },
  },
};

describe("resolveCommandEnvironment", () => {
  it.each([
    ["environment id selector", { environment: "prod_env" }, { id: "prod_env", name: "Production" }],
    ["environment name selector", { environmentName: " Production " }, { id: "prod_env", name: "Production" }],
    [
      "matching environment selectors together",
      { environment: "qa", environmentName: "Config QA" },
      { id: "qa", name: "Config QA" },
    ],
    [
      "valid unknown ids for forward-compatible explicit selection",
      { environment: "future_env" },
      { id: "future_env", name: "future_env" },
    ],
  ])("should resolve %s", (_, params, expected) => {
    expect(resolveCommandEnvironment(config, params)).toEqual(expected);
  });

  it("should fall back to config.environment when cli options are not provided", () => {
    expect(resolveCommandEnvironment(config, {})).toEqual({
      id: "qa",
      name: "Config QA",
    });
  });

  it.each([
    ["environment selectors resolve differently", { environment: "qa", environmentName: "Production" }],
    ["invalid environment ids", { environment: "prod env" }],
    ["invalid environment names", { environmentName: "prod\renv" }],
    ["unknown environment names", { environmentName: "Unknown" }],
  ])("should fail when %s", (_, params) => {
    expect(() => resolveCommandEnvironment(config, params)).toThrow(UsageError);
  });
});
