import { describe, expect, it } from "vitest";

import {
  MAX_ENVIRONMENT_ID_LENGTH,
  MAX_ENVIRONMENT_NAME_LENGTH,
  assertValidEnvironmentName,
  formatNormalizedEnvironmentCollision,
  validateEnvironmentId,
  validateEnvironmentName,
} from "../../src/utils/environment.js";

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

describe("validateEnvironmentId", () => {
  it("accepts authored IDs with latin letters, digits, underscores and hyphens", () => {
    const validBoundaryId = "a".repeat(MAX_ENVIRONMENT_ID_LENGTH);

    expect(validateEnvironmentId("foo")).toEqual({ valid: true, normalized: "foo" });
    expect(validateEnvironmentId("foo_bar")).toEqual({ valid: true, normalized: "foo_bar" });
    expect(validateEnvironmentId("foo-bar")).toEqual({ valid: true, normalized: "foo-bar" });
    expect(validateEnvironmentId("A1_b-2")).toEqual({ valid: true, normalized: "A1_b-2" });
    expect(validateEnvironmentId(validBoundaryId)).toEqual({ valid: true, normalized: validBoundaryId });
    expect(validateEnvironmentId("  foo  ")).toEqual({ valid: true, normalized: "foo" });
  });

  it("rejects ids with internal whitespace or unsupported characters", () => {
    expect(validateEnvironmentId("foo bar")).toEqual({
      valid: false,
      reason: "id must contain only latin letters, digits, underscores, and hyphens",
    });
    expect(validateEnvironmentId("foo/bar")).toEqual({
      valid: false,
      reason: "id must contain only latin letters, digits, underscores, and hyphens",
    });
    expect(validateEnvironmentId("прод")).toEqual({
      valid: false,
      reason: "id must contain only latin letters, digits, underscores, and hyphens",
    });
  });

  it("rejects empty, too long and non-string ids", () => {
    expect(validateEnvironmentId("")).toEqual({
      valid: false,
      reason: "id must not be empty",
    });
    expect(validateEnvironmentId("a".repeat(MAX_ENVIRONMENT_ID_LENGTH + 1))).toEqual({
      valid: false,
      reason: `id must not exceed ${MAX_ENVIRONMENT_ID_LENGTH} characters`,
    });
    expect(validateEnvironmentId(1)).toEqual({
      valid: false,
      reason: "id must be a string",
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
