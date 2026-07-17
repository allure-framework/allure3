import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { type Config, defineConfig } from "../src/config.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-config");
  await story("config");
  await label("coverage", "report-config");
});

describe("defineConfig", () => {
  it("should return provided config", () => {
    const config: Config = {};
    const defined = defineConfig(config);

    expect(defined).toBe(config);
  });
});
