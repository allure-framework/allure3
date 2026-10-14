import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { parseURLPath } from "../src/utils.js";

beforeEach(async () => {
  await story("utils");
});
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
