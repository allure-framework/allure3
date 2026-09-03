import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { flatGlobalEntriesByEnv, globalEntriesByEnv } from "@/utils/globals";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-data-model");
  await story("globals");
  await label("coverage", "report-data-model");
});

const entriesByEnv = {
  default: ["shared"],
  qa_env: ["qa"],
  prod_env: ["prod"],
};

describe("utils > globalEntriesByEnv", () => {
  it("should return every non-empty bucket when no environment is selected", () => {
    expect(globalEntriesByEnv(["shared", "qa", "prod"], entriesByEnv, "")).toEqual([
      ["default", ["shared"]],
      ["qa_env", ["qa"]],
      ["prod_env", ["prod"]],
    ]);
  });

  it("should skip empty buckets", () => {
    expect(globalEntriesByEnv(["qa"], { default: [], qa_env: ["qa"] }, "")).toEqual([["qa_env", ["qa"]]]);
  });

  it("should return the selected bucket followed by the shared one", () => {
    expect(globalEntriesByEnv(["shared", "qa", "prod"], entriesByEnv, "qa_env")).toEqual([
      ["qa_env", ["qa"]],
      ["default", ["shared"]],
    ]);
  });

  it("should return the shared bucket only once when the default environment is selected", () => {
    expect(globalEntriesByEnv(["shared", "qa", "prod"], entriesByEnv, "default")).toEqual([["default", ["shared"]]]);
  });

  it("should return the shared bucket for an environment without own entries", () => {
    expect(globalEntriesByEnv(["shared"], { default: ["shared"] }, "qa_env")).toEqual([["default", ["shared"]]]);
  });

  it("should return nothing when neither the selected nor the shared bucket has entries", () => {
    expect(globalEntriesByEnv(["prod"], { prod_env: ["prod"] }, "qa_env")).toEqual([]);
  });

  it("should treat the flat list as shared when there is no per-environment breakdown", () => {
    expect(globalEntriesByEnv(["legacy"], {}, "qa_env")).toEqual([["default", ["legacy"]]]);
    expect(globalEntriesByEnv(["legacy"], {}, "")).toEqual([["default", ["legacy"]]]);
  });

  it("should return nothing for an empty widget", () => {
    expect(globalEntriesByEnv([], {}, "")).toEqual([]);
    expect(globalEntriesByEnv([], {}, "qa_env")).toEqual([]);
  });
});

describe("utils > flatGlobalEntriesByEnv", () => {
  it("should flatten the resolved buckets", () => {
    expect(flatGlobalEntriesByEnv(["shared", "qa", "prod"], entriesByEnv, "qa_env")).toEqual(["qa", "shared"]);
    expect(flatGlobalEntriesByEnv(["shared", "qa", "prod"], entriesByEnv, "")).toEqual(["shared", "qa", "prod"]);
  });
});
