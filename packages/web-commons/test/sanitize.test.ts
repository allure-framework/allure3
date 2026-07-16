import { describe, expect, it } from "vitest";

import { sanitizeHtmlDocument } from "../src/sanitize.js";

describe("sanitizeHtmlDocument", () => {
  it("preserves head styles and meta charset", () => {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>.zh{background:yellow;color:red;}</style>
</head>
<body>
<div class="zh">你好世界</div>
</body>
</html>`;

    const result = sanitizeHtmlDocument(html);

    expect(result).toContain("<style>.zh{background:yellow;color:red;}</style>");
    expect(result).toContain('charset="utf-8"');
    expect(result).toContain("你好世界");
  });

  it("always adds a doctype, so the iframe renders in standards mode", () => {
    const withoutDoctype = sanitizeHtmlDocument(`<html><head></head><body>hi</body></html>`);
    const withDoctype = sanitizeHtmlDocument(`<!DOCTYPE html><html><head></head><body>hi</body></html>`);

    expect(withoutDoctype.toLowerCase()).toMatch(/^<!doctype html>/);
    expect(withDoctype.toLowerCase()).toMatch(/^<!doctype html>/);
    // DOMPurify has no doctype node, so it must not appear twice regardless of the input.
    expect(withDoctype.toLowerCase().match(/<!doctype/g)).toHaveLength(1);
  });

  it("preserves linked stylesheets", () => {
    const html = `<html><head><link rel="stylesheet" href="https://example.com/style.css"></head><body>hi</body></html>`;

    const result = sanitizeHtmlDocument(html);

    expect(result).toContain('<link rel="stylesheet" href="https://example.com/style.css">');
  });

  it("strips script tags", () => {
    const html = `<html><head><script>alert(1)</script></head><body><script>alert(2)</script>hi</body></html>`;

    const result = sanitizeHtmlDocument(html);

    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).not.toContain("alert(2)");
  });

  it("strips base tags to prevent base-uri hijacking", () => {
    const html = `<html><head><base href="https://evil.example"></head><body>hi</body></html>`;

    const result = sanitizeHtmlDocument(html);

    expect(result).not.toContain("<base");
    expect(result).not.toContain("evil.example");
  });

  it("strips http-equiv attribute to prevent meta-refresh redirects", () => {
    const html = `<html><head><meta http-equiv="refresh" content="0;url=https://evil.example"></head><body>hi</body></html>`;

    const result = sanitizeHtmlDocument(html);

    expect(result).not.toContain("http-equiv");
  });
});
