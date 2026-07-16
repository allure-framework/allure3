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
