import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { redactParameters } from "../../src/utils/parameter.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-data-model");
  await story("parameter");
  await label("coverage", "report-data-model");
});

describe("parameter utils", () => {
  it("should remove hidden parameters and replace masked values", () => {
    const parameters = redactParameters([
      { name: "visible", value: "value", hidden: false, masked: false, excluded: false },
      { name: "token", value: "secret-token", hidden: false, masked: true, excluded: false },
      { name: "internal", value: "hidden-value", hidden: true, masked: false, excluded: false },
      { name: "hidden-token", value: "hidden-token-value", hidden: true, masked: true, excluded: false },
    ]);

    expect(parameters).toEqual([
      { name: "visible", value: "value", hidden: false, masked: false, excluded: false },
      { name: "token", value: "<masked>", hidden: false, masked: true, excluded: false },
    ]);
    expect(JSON.stringify(parameters)).not.toContain("secret-token");
    expect(JSON.stringify(parameters)).not.toContain("hidden-value");
    expect(JSON.stringify(parameters)).not.toContain("hidden-token-value");
  });

  it("should handle missing parameter collections", () => {
    expect(redactParameters(undefined)).toEqual([]);
  });
});
