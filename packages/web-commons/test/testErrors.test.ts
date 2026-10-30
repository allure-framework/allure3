import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { hasErrorDiff } from "../src/errors.js";
import { isDisplayableTestError, normalizeErrorText } from "../src/testErrors.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("web-commons");
  await label("coverage", "web-commons");
});

describe("error visibility", () => {
  beforeEach(async () => {
    await story("displayable errors");
  });

  it.each([
    { name: "message only", error: { message: "boom" }, expected: true },
    { name: "trace only", error: { trace: "at foo (bar.ts:1)" }, expected: true },
    { name: "diff only", error: { expected: "1", actual: "2" }, expected: true },
    { name: "ANSI-only message", error: { message: "\u001b[31m\u001b[39m  " }, expected: false },
    { name: "serialized undefined diff", error: { expected: "undefined", actual: "2" }, expected: false },
    { name: "empty error", error: {}, expected: false },
    { name: "missing error", error: undefined, expected: false },
  ])("$name is displayable: $expected", ({ error, expected }) => {
    expect(isDisplayableTestError(error)).toBe(expected);
  });

  it("requires both sides of the diff", () => {
    expect(hasErrorDiff({ expected: "1", actual: "2" })).toBe(true);
    expect(hasErrorDiff({ expected: "1" })).toBe(false);
    expect(hasErrorDiff({ actual: "2", expected: "undefined" })).toBe(false);
  });
});

describe("normalizeErrorText", () => {
  it("strips ANSI sequences and surrounding whitespace", () => {
    expect(normalizeErrorText("  \u001b[31mred\u001b[39m text \n")).toBe("red text");
  });

  it("returns an empty string for non-strings", () => {
    expect(normalizeErrorText(undefined)).toBe("");
  });
});
