import { describe, expect, it } from "vitest";
import { parseOwnerAddress } from "../../src/utils/ownerAddress.js";

describe("utils > ownerAddress", () => {
  describe("parseOwnerAddress", () => {
    it("returns none type with empty displayName for null input", () => {
      const result = parseOwnerAddress(null as unknown as string);
      expect(result).toEqual({ displayName: "", type: "none" });
    });

    it("returns none type with empty displayName for empty input", () => {
      const result = parseOwnerAddress("");
      expect(result).toEqual({ displayName: "", type: "none" });
    });

    it("returns none type for whitespace-only input", () => {
      const result = parseOwnerAddress("   ");
      expect(result).toEqual({ displayName: "", type: "none" });
    });

    it("parses RFC 2822 string with email", () => {
      const input = "John Doe < john.doe@example.com >";
      const result = parseOwnerAddress(input);
      expect(result.displayName).toBe("John Doe");
      expect(result.type).toBe("email");
      expect("email" in result && result.email).toBe("john.doe@example.com");
    });

    it("parses RFC 2822 string with URL", () => {
      const input = "John Doe <https://github.com/@john.doe>";
      const result = parseOwnerAddress(input);
      expect(result.displayName).toBe("John Doe");
      expect(result.type).toBe("url");
      expect("url" in result && result.url).toBe("https://github.com/@john.doe");
    });

    it("returns only displayName (type none) for empty RFC 2822 address", () => {
      const result = parseOwnerAddress("John Doe <>");
      expect(result.displayName).toBe("John Doe");
      expect(result.type).toBe("none");
    });

    it("returns displayName for plain text input", () => {
      const result = parseOwnerAddress("John Doe");
      expect(result.displayName).toBe("John Doe");
      expect(result.type).toBe("none");
    });

    it("returns email type and mailto for plain email", () => {
      const email = "john.doe@example.com";
      const result = parseOwnerAddress(email);
      expect(result.displayName).toBe(email);
      expect(result.type).toBe("email");
      expect("email" in result && result.email).toBe(email);
    });

    it("returns url type for plain valid URL", () => {
      const url = "https://github.com/john.doe";
      const result = parseOwnerAddress(url);
      expect(result.displayName).toBe(url);
      expect(result.type).toBe("url");
      expect("url" in result && result.url).toBe(url);
    });

    it("returns only displayName (type none) for invalid URL", () => {
      const result = parseOwnerAddress("htp:/www.example.com/page");
      expect(result.displayName).toBe("htp:/www.example.com/page");
      expect(result.type).toBe("none");
    });

    it("returns only displayName (type none) for invalid email", () => {
      const result = parseOwnerAddress("user@.example.com");
      expect(result.displayName).toBe("user@.example.com");
      expect(result.type).toBe("none");
    });

    it("returns invalid RFC 2822 address unchanged as plain text", () => {
      const result = parseOwnerAddress("John Doe <john@@doe>");
      expect(result.displayName).toBe("John Doe <john@@doe>");
      expect(result.type).toBe("none");
    });

    it("accepts http URL", () => {
      const result = parseOwnerAddress("http://example.com");
      expect(result.type).toBe("url");
      expect("url" in result && result.url).toBe("http://example.com");
    });
  });
});
