import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-classic");
  await story("dummy");
  await label("coverage", "plugin-classic");
});

describe("dummy", () => {
  it("works", () => {
    expect(true).toBe(true);
  });
});
