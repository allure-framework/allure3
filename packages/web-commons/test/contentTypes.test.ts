import { describe, expect, it } from "vite-plus/test";

import {
  isHtmlAttachmentContentType,
  isJsonAttachmentContentType,
  normalizeAttachmentContentType,
} from "../src/contentTypes.js";

describe("attachment content types", () => {
  it.each([
    [" Application/JSON ; charset=UTF-8", "application/json"],
    ["TEXT/TAB-SEPARATED-VALUES; charset=utf-8", "text/tab-separated-values"],
    ["application/vnd.allure.playwright-trace; version=1", "application/vnd.allure.playwright-trace"],
    ["application/x-unknown", "application/x-unknown"],
    [" ; charset=utf-8", ""],
    ["", ""],
    [undefined, undefined],
    [null, undefined],
  ])("normalizes %s without assigning a fallback type", (input, expected) => {
    expect(normalizeAttachmentContentType(input)).toBe(expected);
  });

  it.each([
    [" Application/JSON ; charset=UTF-8", true, false],
    ["text/json", true, false],
    ["application/problem+json; charset=utf-8", true, false],
    ["TEXT/HTML ; charset=utf-8", false, true],
    ["application/xhtml+xml", false, true],
    ["application/jsonp", false, false],
    ["application/json+zip", false, false],
    ["text/plain", false, false],
    ["", false, false],
  ])("recognizes JSON and HTML for %s", (input, json, html) => {
    expect(isJsonAttachmentContentType(input)).toBe(json);
    expect(isHtmlAttachmentContentType(input)).toBe(html);
  });
});
