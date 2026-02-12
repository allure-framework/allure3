import { describe, expect, it } from "vitest";
import { parseURLPath } from "../src/utils.js";

describe("utils", () => {
  describe("parseURLPath", () => {
    it("should parse URL path", () => {
      expect(parseURLPath("")).toBe("");
      expect(parseURLPath("https://example.com")).toBe("");
      expect(parseURLPath("https://example.com/path/to/file")).toBe("path/to/file");
      expect(parseURLPath("https://example.com/path/to/file/")).toBe("path/to/file/");
    });
  });
});
