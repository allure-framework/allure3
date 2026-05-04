import { label } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { getHistoryUrl, isSameDocumentUrl, toSameDocumentHistoryUrl } from "../../../src/stores/url/helpers.js";

describe("stores > url > helpers", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
  });

  describe("isSameDocumentUrl", () => {
    it("matches same Windows network-share file document URLs", () => {
      const currentHref = "file://filer/share/report.html?filter=retry#old";
      const nextUrl = new URL("file://filer/share/report.html?retry=true#testresult/1");

      expect(isSameDocumentUrl(nextUrl, currentHref)).toBe(true);
    });

    it("rejects different Windows network-share file document URLs", () => {
      const currentHref = "file://filer/share/report.html";
      const nextUrl = new URL("file://filer/other/report.html#testresult/1");

      expect(isSameDocumentUrl(nextUrl, currentHref)).toBe(false);
    });
  });

  describe("toSameDocumentHistoryUrl", () => {
    it("formats same-document query and hash as a relative history URL", () => {
      const url = new URL("file://filer/share/report.html?retry=true#testresult/1");

      expect(toSameDocumentHistoryUrl(url)).toBe("?retry=true#testresult/1");
    });

    it("formats same-document hash-only routes as relative history URLs", () => {
      const url = new URL("file://filer/share/report.html#testresult/1");

      expect(toSameDocumentHistoryUrl(url)).toBe("#testresult/1");
    });

    it("formats same-document root routes as a relative file URL", () => {
      const url = new URL("file://filer/share/report.html");

      expect(toSameDocumentHistoryUrl(url)).toBe("report.html");
    });
  });

  describe("getHistoryUrl", () => {
    it("uses a relative history URL for same-document Windows network-share file URLs", () => {
      const currentHref = "file://filer/share/report.html";
      const nextUrl = new URL("file://filer/share/report.html#testresult/1");

      expect(getHistoryUrl(nextUrl, currentHref)).toBe("#testresult/1");
    });

    it("uses a relative history URL for same-document Windows network-share file URLs with query params", () => {
      const currentHref = "file://filer/share/report.html?filter=retry";
      const nextUrl = new URL("file://filer/share/report.html?retry=true#testresult/1");

      expect(getHistoryUrl(nextUrl, currentHref)).toBe("?retry=true#testresult/1");
    });
  });
});
