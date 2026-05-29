import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { extension } from "../src/utils.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("reading");
  await story("utils");
  await label("coverage", "reading");
});

describe("extension", () => {
  it("should return original extension if any", () => {
    const result = extension("some.json", "text/plain");
    expect(result).toEqual(".json");
  });

  it("should return extension based on content type if no file extension", () => {
    const result = extension("without-extension", "text/plain");
    expect(result).toEqual(".txt");
  });
});
