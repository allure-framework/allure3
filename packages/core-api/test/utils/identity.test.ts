import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import {
  calculateEnvironmentHash,
  calculateParametersHash,
  calculateRetryHash,
  calculateTestCaseHash,
  md5Utf8,
} from "../../src/index.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("identity");
  await story("canonical hashes");
  await label("coverage", "identity");
});

describe("canonical test identity", () => {
  it("matches the cross-product compatibility vector", () => {
    const testCaseHash = calculateTestCaseHash("test-case-id", undefined);
    const parametersHash = calculateParametersHash([{ name: "argument", value: "value" }]);

    expect(testCaseHash).toBe("97a2c529ed683cc603ce988040c657f8");
    expect(parametersHash).toBe("310bf7d9fc9765b03f3a78f1816f40a8");
    expect(calculateRetryHash(testCaseHash, parametersHash)).toBe(
      "97a2c529ed683cc603ce988040c657f8.310bf7d9fc9765b03f3a78f1816f40a8",
    );
  });

  it("uses fullName only when testCaseId is absent or empty", () => {
    expect(calculateTestCaseHash(undefined, "org.example.ExampleTest.test")).toBe(
      md5Utf8("org.example.ExampleTest.test"),
    );
    expect(calculateTestCaseHash("", "org.example.ExampleTest.test")).toBe(md5Utf8("org.example.ExampleTest.test"));
    expect(calculateTestCaseHash("test-case-id", "org.example.ExampleTest.test")).toBe(md5Utf8("test-case-id"));
  });

  it("does not create stable identity for a dynamic test", () => {
    const parametersHash = calculateParametersHash([]);

    expect(calculateTestCaseHash(undefined, undefined)).toBeUndefined();
    expect(calculateRetryHash(undefined, parametersHash)).toBeUndefined();
  });

  it("normalizes, sorts, and deduplicates parameter pairs", () => {
    const withNoise = calculateParametersHash([
      { name: "argument", value: "value" },
      { name: "argument", value: "value" },
      { name: "ignored", value: "ignored", excluded: true },
      { name: "", value: "ignored" },
      { name: null, value: "ignored" },
      null,
    ]);

    expect(withNoise).toBe("310bf7d9fc9765b03f3a78f1816f40a8");
  });

  it("keeps parameters with the same name and different values", () => {
    expect(
      calculateParametersHash([
        { name: "argument", value: "second" },
        { name: "argument", value: "first" },
      ]),
    ).toBe("6e29f32eaf2b41fc71988ccc7ad13ac2");
  });

  it("sorts parameter names by UTF-8 bytes", () => {
    expect(
      calculateParametersHash([
        { name: "😀", value: "value" },
        { name: "", value: "value" },
      ]),
    ).toBe("a6cd7ed419df4da92294adabd4ff4904");
  });

  it("uses the compatibility sentinel for null parameter values", () => {
    expect(calculateParametersHash([{ name: "missing", value: null }])).toBe("3bf9dbcebd98256fba82c63e37384e7d");
  });

  it("hashes only explicitly supplied named environment ids", () => {
    const testCaseHash = md5Utf8("test-case-id");
    const parametersHash = md5Utf8("");
    const environmentHash = calculateEnvironmentHash("qa");

    expect(calculateEnvironmentHash(undefined)).toBeUndefined();
    expect(calculateRetryHash(testCaseHash, parametersHash)).toHaveLength(65);
    expect(calculateRetryHash(testCaseHash, parametersHash, environmentHash)).toHaveLength(98);
  });
});
