import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { detectContentType } from "../src/detect.js";
import { readResource, resources } from "./utils.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("reading");
  await story("detect");
  await label("coverage", "reading");
});

describe("detectContentType", () => {
  it.each(resources)("should detect %s as %s", async (resource, expectedType) => {
    const bytes = await readResource(resource);
    const result = detectContentType(bytes);
    expect(result).toEqual(expectedType);
  });
});
