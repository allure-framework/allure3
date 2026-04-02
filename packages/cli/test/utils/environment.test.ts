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

  it("should reject explicit environment ids outside allowedEnvironments", () => {
    expect(() =>
      resolveCommandEnvironment(
        {
          ...config,
          allowedEnvironments: ["qa"],
        },
        { environment: "prod_env" },
      ),
    ).toThrow('cli: environment id "prod_env" is not listed in allowedEnvironments');
  });

  it("should reject environment names that resolve outside allowedEnvironments", () => {
    expect(() =>
      resolveCommandEnvironment(
        {
          ...config,
          allowedEnvironments: ["qa"],
        },
        { environmentName: "Production" },
      ),
    ).toThrow('cli: environment id "prod_env" is not listed in allowedEnvironments');
  });

  it("should reject config fallback environments outside allowedEnvironments", () => {
    expect(() =>
      resolveCommandEnvironment(
        {
          ...config,
          allowedEnvironments: ["prod_env"],
        },
        {},
      ),
    ).toThrow('cli: environment id "qa" is not listed in allowedEnvironments');
  });

  it("should use exact raw allowedEnvironments membership for config fallback environments", () => {
    expect(() =>
      resolveCommandEnvironment(
        {
          ...config,
          allowedEnvironments: [" qa "],
        },
        {},
      ),
    ).toThrow('cli: environment id "qa" is not listed in allowedEnvironments');
  });

  it("should not match display-name-only allowedEnvironments entries", () => {
    expect(() =>
      resolveCommandEnvironment(
        {
          ...config,
          allowedEnvironments: ["Production"],
        },
        { environmentName: "Production" },
      ),
    ).toThrow('cli: environment id "prod_env" is not listed in allowedEnvironments');
  });
});
