import { describe, expect, it } from "vitest";

import { createReportDataScript, stringifyForInlineScript } from "../src/static.js";

describe("createReportDataScript", () => {
  it("should escape windows-like report data paths safely", () => {
    const script = createReportDataScript([
      {
        name: "widgets\\default\\tree.json",
        value: "dmFsdWU=",
      },
    ]);

    expect(script).toContain('d("widgets\\\\default\\\\tree.json","dmFsdWU=")');
  });

  it("should generate JSON-stringified data declarations", () => {
    const script = createReportDataScript([
      {
        name: "widgets/default/nav.json",
        value: "eyJmb28iOiJiYXIifQ==",
      },
    ]);

    expect(script).toContain('d("widgets/default/nav.json","eyJmb28iOiJiYXIifQ==")');
    expect(script).not.toContain("d('widgets/default/nav.json'");
  });
});

describe("stringifyForInlineScript", () => {
  it("escapes script-breaking and html-sensitive characters", () => {
    const out = stringifyForInlineScript({
      payload: "</script><script>alert(1)</script>",
      html: "<b>&</b>",
    });

    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003C/script\\u003E\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E");
    expect(out).toContain("\\u003Cb\\u003E\\u0026\\u003C/b\\u003E");
  });

  it("escapes javascript line separator characters", () => {
    const out = stringifyForInlineScript("a\u2028b\u2029c");

    expect(out).toBe('"a\\u2028b\\u2029c"');
  });
});
