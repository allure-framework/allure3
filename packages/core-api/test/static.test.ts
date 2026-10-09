import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createReportDataScript,
  injectReportDataScript,
  reportDataScriptPlaceholder,
  stringifyForInlineScript,
} from "../src/static.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-data-model");
  await story("static");
  await label("coverage", "report-data-model");
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("should escape script-breaking report data paths", () => {
    const script = createReportDataScript([
      {
        name: "data/</script><script>alert(1)</script>.json",
        value: "dmFsdWU=",
      },
    ]);

    expect(script).not.toContain("</script><script>alert(1)</script>");
    expect(script).toContain("data/\\u003C/script\\u003E\\u003Cscript\\u003Ealert(1)");
  });
});

describe("injectReportDataScript", () => {
  it("should embed report files without assembling all declarations into a string", () => {
    const concatSpy = vi.spyOn(Buffer, "concat");
    const reportFiles = Array.from({ length: 3 }, (_, index) => ({
      name: `data/attachments/video-${index}.webm`,
      value: "dmFsdWU=".repeat(1_000),
    }));

    const html = injectReportDataScript(`<html>${reportDataScriptPlaceholder}</html>`, reportFiles);
    const chunks = concatSpy.mock.calls[0]?.[0] ?? [];

    expect(html.toString("utf8")).toContain('d("data/attachments/video-2.webm","dmFsdWU=');
    expect(chunks).toHaveLength(reportFiles.length + 4);
    expect(chunks.every((chunk) => Buffer.isBuffer(chunk))).toBe(true);
  });

  it("should mark empty report data as ready", () => {
    const html = injectReportDataScript(`<html>${reportDataScriptPlaceholder}</html>`).toString("utf8");

    expect(html).toContain("window.allureReportDataReady = true;");
    expect(html).not.toContain(reportDataScriptPlaceholder);
  });

  it("should escape script-breaking paths in injected report data", () => {
    const html = injectReportDataScript(`<html>${reportDataScriptPlaceholder}</html>`, [
      {
        name: "data/</script><script>alert(1)</script>.json",
        value: "dmFsdWU=",
      },
    ]).toString("utf8");

    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("data/\\u003C/script\\u003E\\u003Cscript\\u003Ealert(1)");
  });

  it("should reject templates without the report data placeholder", () => {
    expect(() => injectReportDataScript("<html></html>")).toThrow(
      "Report data script placeholder is missing from the HTML template",
    );
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
