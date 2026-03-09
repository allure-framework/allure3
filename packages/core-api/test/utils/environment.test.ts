import { describe, expect, it } from "vitest";

import type { EnvironmentsConfig } from "../../src/index.js";
import type { TestResult } from "../../src/model.js";
import {
  MAX_ENVIRONMENT_NAME_LENGTH,
  assertValidEnvironmentName,
  formatNormalizedEnvironmentCollision,
  matchEnvironment,
  validateEnvironmentName,
} from "../../src/utils/environment.js";

const fixtures = {
  envConfig: {
    foo: {
      variables: {
        foo: "bar",
      },
      matcher: ({ labels }) => !!labels.find(({ name, value }) => name === "foo" && value === "bar"),
    },
  } as EnvironmentsConfig,
};

describe("matchEnvironment", () => {
  it("should return matched environment", () => {
    const result = matchEnvironment(fixtures.envConfig, {
      labels: [
        {
          name: "foo",
          value: "bar",
        },
      ],
    } as TestResult);

    expect(result).toEqual(Object.keys(fixtures.envConfig)[0]);
  });

  it("should return default when no environment is matched", () => {
    const result = matchEnvironment(fixtures.envConfig, {
      labels: [
        {
          name: "foo",
          value: "baz",
        },
      ],
    } as TestResult);

    expect(result).toEqual("default");
  });
});

describe("validateEnvironmentName", () => {
  it("accepts valid names and returns normalized value", () => {
    const validBoundaryName = "a".repeat(MAX_ENVIRONMENT_NAME_LENGTH);

    expect(validateEnvironmentName("foo")).toEqual({ valid: true, normalized: "foo" });
    expect(validateEnvironmentName("__proto__")).toEqual({ valid: true, normalized: "__proto__" });
    expect(validateEnvironmentName("прод")).toEqual({ valid: true, normalized: "прод" });
    expect(validateEnvironmentName(validBoundaryName)).toEqual({ valid: true, normalized: validBoundaryName });
    expect(validateEnvironmentName("  foo  ")).toEqual({ valid: true, normalized: "foo" });
    expect(validateEnvironmentName(" default ")).toEqual({ valid: true, normalized: "default" });
  });

  it("accepts names previously blocked by filesystem-style checks", () => {
    expect(validateEnvironmentName("foo/bar")).toEqual({ valid: true, normalized: "foo/bar" });
    expect(validateEnvironmentName("foo#bar")).toEqual({ valid: true, normalized: "foo#bar" });
    expect(validateEnvironmentName("foo%bar")).toEqual({ valid: true, normalized: "foo%bar" });
    expect(validateEnvironmentName("foo:bar")).toEqual({ valid: true, normalized: "foo:bar" });
    expect(validateEnvironmentName(".")).toEqual({ valid: true, normalized: "." });
    expect(validateEnvironmentName("..")).toEqual({ valid: true, normalized: ".." });
  });

  it("rejects empty and whitespace-only names", () => {
    expect(validateEnvironmentName("")).toEqual({
      valid: false,
      reason: "name must not be empty",
    });
    expect(validateEnvironmentName("   ")).toEqual({
      valid: false,
      reason: "name must not be empty",
    });
  });

  it("rejects too long names after trim", () => {
    const tooLongName = ` ${"a".repeat(MAX_ENVIRONMENT_NAME_LENGTH + 1)} `;

    expect(validateEnvironmentName(tooLongName)).toEqual({
      valid: false,
      reason: `name must not exceed ${MAX_ENVIRONMENT_NAME_LENGTH} characters`,
    });
  });

  it("rejects control characters", () => {
    expect(validateEnvironmentName("foo\nbar")).toEqual({
      valid: false,
      reason: "name must not contain control characters",
    });
    expect(validateEnvironmentName("foo\tbar")).toEqual({
      valid: false,
      reason: "name must not contain control characters",
    });
    expect(validateEnvironmentName("foo\u0000bar")).toEqual({
      valid: false,
      reason: "name must not contain control characters",
    });
    expect(validateEnvironmentName("foo\u009Fbar")).toEqual({
      valid: false,
      reason: "name must not contain control characters",
    });
    expect(validateEnvironmentName("foo\rbar")).toEqual({
      valid: false,
      reason: "name must not contain control characters",
    });
    expect(validateEnvironmentName("foo\r\nbar")).toEqual({
      valid: false,
      reason: "name must not contain control characters",
    });
  });

  it("rejects non-string input", () => {
    expect(validateEnvironmentName(1)).toEqual({
      valid: false,
      reason: "name must be a string",
    });
  });
});

describe("assertValidEnvironmentName", () => {
  it("returns normalized value", () => {
    expect(assertValidEnvironmentName("  foo  ")).toBe("foo");
  });

  it("throws with source details", () => {
    expect(() => assertValidEnvironmentName("", "config.environment")).toThrow(
      'Invalid config.environment "": name must not be empty',
    );
  });
});

describe("formatNormalizedEnvironmentCollision", () => {
  it("formats stable collision message", () => {
    expect(formatNormalizedEnvironmentCollision("config.environments", "foo", ["foo", " foo "])).toBe(
      'config.environments: normalized key "foo" is produced by original keys ["foo"," foo "]',
    );
  });
});
