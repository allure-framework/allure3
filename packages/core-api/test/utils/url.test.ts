import { describe, expect, it } from "vitest";

import { sanitizeExternalUrl } from "../../src/utils/url.js";

describe("sanitizeExternalUrl", () => {
  it("allows known-safe protocols", () => {
    expect(sanitizeExternalUrl("https://example.com/path?x=1#hash")).toBe("https://example.com/path?x=1#hash");
    expect(sanitizeExternalUrl("http://example.com")).toBe("http://example.com/");
    expect(sanitizeExternalUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
    expect(sanitizeExternalUrl("tel:+123456789")).toBe("tel:+123456789");
  });

  it("rejects unsafe or malformed urls", () => {
    expect(sanitizeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeExternalUrl(" data:text/html,<svg onload=alert(1)>")).toBeUndefined();
    expect(sanitizeExternalUrl("file:///etc/passwd")).toBeUndefined();
    expect(sanitizeExternalUrl("/relative/path")).toBeUndefined();
    expect(sanitizeExternalUrl("")).toBeUndefined();
    expect(sanitizeExternalUrl("   ")).toBeUndefined();
    expect(sanitizeExternalUrl(undefined)).toBeUndefined();
  });
});
