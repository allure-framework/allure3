import { describe, expect, it } from "vitest";
import { detectContentType } from "../src/detect.js";
import { readResource, resources } from "./utils.js";

describe("detectContentType", () => {
  it.each(resources)("should detect %s as %s", async (resource, expectedType) => {
    const bytes = await readResource(resource);
    const result = detectContentType(bytes);
    expect(result).toEqual(expectedType);
  });
});
