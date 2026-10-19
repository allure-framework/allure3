import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getHistoryUrl, isSameDocumentUrl, toSameDocumentHistoryUrl } from "../../../src/stores/url/helpers.js";

describe("stores > url > helpers", () => {
  beforeEach(async () => {
    await label("layer", "unit");
    await label("component", "web-commons");
    await epic("coverage");
    await feature("url-routing");
    await story("helpers");
    await label("coverage", "url-routing");
  });

  afterEach(() => {
    document.querySelectorAll("base").forEach((base) => base.remove());
    window.history.replaceState(null, "", "/");
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
    it("formats same-document query and hash relative to the current file", () => {
      const url = new URL("file://filer/share/report.html?retry=true#testresult/1");

      expect(toSameDocumentHistoryUrl(url)).toBe("report.html?retry=true#testresult/1");
    });

    it("formats same-document hash-only routes relative to the current file", () => {
      const url = new URL("file://filer/share/report.html#testresult/1");

      expect(toSameDocumentHistoryUrl(url)).toBe("report.html#testresult/1");
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

      expect(getHistoryUrl(nextUrl, currentHref)).toBe("report.html#testresult/1");
    });

    it("uses a relative history URL for same-document Windows network-share file URLs with query params", () => {
      const currentHref = "file://filer/share/report.html?filter=retry";
      const nextUrl = new URL("file://filer/share/report.html?retry=true#testresult/1");

      expect(getHistoryUrl(nextUrl, currentHref)).toBe("report.html?retry=true#testresult/1");
    });

    it("keeps same-document navigation on the current file when a base URL points to the containing directory", () => {
      const currentHref = `${window.location.origin}/share/report.html`;
      const base = document.createElement("base");

      window.history.replaceState(null, "", currentHref);
      base.href = new URL(".", window.location.href).href;
      document.head.prepend(base);

      const historyUrl = getHistoryUrl(new URL(`${currentHref}#testresult/1`), window.location.href);

      window.history.pushState(null, "", historyUrl);

      expect(window.location.href).toBe(`${currentHref}#testresult/1`);
    });
  });
});
