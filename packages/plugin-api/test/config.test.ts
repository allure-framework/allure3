import { describe, expect, it } from "vitest";
import { type Config, defineConfig } from "../src/config.js";

describe("defineConfig", () => {
  it("should return provided config", () => {
    const config: Config = {};
    const defined = defineConfig(config);

    expect(defined).toBe(config);
  });
});
