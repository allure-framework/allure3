import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { constructFilterParams } from "../../../src/stores/treeFilters/utils.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-state");
  await story("tree-filter-params");
  await label("coverage", "ui-state");
});

describe("stores > treeFilters > utils", () => {
  it("should construct known filter params", () => {
    const params = constructFilterParams({ known: true });

    expect(params.toString()).toBe("known=true");
  });

  it("should construct known and status filter params", () => {
    const params = constructFilterParams({ known: true, status: "failed" });

    expect(params.toString()).toBe("status=failed&known=true");
  });
});
