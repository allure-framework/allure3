import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { DEFAULT_TAB, parseRoute } from "../src/stores/router.js";
import { getTestResultHash, getTestResultTabHash } from "../src/utils/testResultNavigation.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("router");
  await label("coverage", "ui-components");
});

describe("parseRoute", () => {
  it("should open Overview when the hash is empty", () => {
    expect(DEFAULT_TAB).toBe("overview");
    expect(parseRoute("")).toEqual({
      tabName: "overview",
      params: { id: null, testResultId: null, testResultTab: null },
    });
    expect(parseRoute("#")).toEqual({
      tabName: "overview",
      params: { id: null, testResultId: null, testResultTab: null },
    });
  });

  it("should parse the tab name and its params", () => {
    expect(parseRoute("#suites/node-id/tr-id")).toEqual({
      tabName: "suites",
      params: { id: "node-id", testResultId: "tr-id", testResultTab: null },
    });
    expect(parseRoute("timeline")).toEqual({
      tabName: "timeline",
      params: { id: null, testResultId: null, testResultTab: null },
    });
  });

  it("should parse a group link without a test result", () => {
    expect(parseRoute("#behaviors/group-id")).toEqual({
      tabName: "behaviors",
      params: { id: "group-id", testResultId: null, testResultTab: null },
    });
  });

  it("should parse the test result tab after the test result id", () => {
    expect(parseRoute("#suites/node-id/tr-id/history")).toEqual({
      tabName: "suites",
      params: { id: "node-id", testResultId: "tr-id", testResultTab: "history" },
    });
  });

  it("should parse the standalone test result page with and without the tab", () => {
    expect(parseRoute("#testresult/tr-id")).toEqual({
      tabName: "testresult",
      params: { id: "tr-id", testResultId: null, testResultTab: null },
    });
    expect(parseRoute("#testresult/tr-id/retries")).toEqual({
      tabName: "testresult",
      params: { id: "tr-id", testResultId: null, testResultTab: "retries" },
    });
  });
});

describe("test result hashes", () => {
  it("should keep the test result tab when moving to another test result", () => {
    const route = parseRoute("#suites/node-id/a/history");

    expect(getTestResultHash(route, "b")).toBe("suites/node-id/b/history");
    expect(getTestResultHash(parseRoute("#testresult/a/attachments"), "b")).toBe("testresult/b/attachments");
  });

  it("should leave the overview tab out of the hash", () => {
    expect(getTestResultHash(parseRoute("#suites/node-id/a/overview"), "b")).toBe("suites/node-id/b");
    expect(getTestResultTabHash(parseRoute("#suites/node-id/a/history"), "overview")).toBe("suites/node-id/a");
  });

  it("should build the hash of the current test result on another tab", () => {
    expect(getTestResultTabHash(parseRoute("#suites/node-id/a"), "history")).toBe("suites/node-id/a/history");
    expect(getTestResultTabHash(parseRoute("#behaviors//a/history"), "retries")).toBe("behaviors/root/a/retries");
    expect(getTestResultTabHash(parseRoute("#testresult/a"), "retries")).toBe("testresult/a/retries");
  });

  it("should not build a tab hash without an opened test result", () => {
    expect(getTestResultTabHash(parseRoute("#suites/node-id"), "history")).toBeUndefined();
  });

  it("should round-trip the built hashes through the parser", () => {
    const route = parseRoute(`#${getTestResultTabHash(parseRoute("#suites/node-id/a"), "attachments")}`);

    expect(route).toEqual({
      tabName: "suites",
      params: { id: "node-id", testResultId: "a", testResultTab: "attachments" },
    });
  });
});
