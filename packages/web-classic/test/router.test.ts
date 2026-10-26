import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { DEFAULT_TAB, parseRoute } from "../src/stores/router.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("router");
  await label("coverage", "ui-components");
});

describe("parseRoute", () => {
  it("should open Overview when the hash is empty", () => {
    expect(DEFAULT_TAB).toBe("overview");
    expect(parseRoute("")).toEqual({ tabName: "overview", params: { id: null, testResultId: null } });
    expect(parseRoute("#")).toEqual({ tabName: "overview", params: { id: null, testResultId: null } });
  });

  it("should parse the tab name and its params", () => {
    expect(parseRoute("#suites/node-id/tr-id")).toEqual({
      tabName: "suites",
      params: { id: "node-id", testResultId: "tr-id" },
    });
    expect(parseRoute("timeline")).toEqual({ tabName: "timeline", params: { id: null, testResultId: null } });
  });
});
