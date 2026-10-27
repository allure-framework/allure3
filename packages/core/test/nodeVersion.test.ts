import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  assertNodeSupportsTsConfig,
  formatTsConfigNodeVersionError,
  satisfiesMinimumNodeVersion,
} from "../src/utils/nodeVersion.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-config");
  await story("node-version");
  await label("coverage", "report-config");
});

describe("satisfiesMinimumNodeVersion", () => {
  it.each(["22.18.0", "22.18.1", "22.19.0", "23.0.0", "24.14.0"])("returns true for %s", (version) => {
    expect(satisfiesMinimumNodeVersion(version)).toBe(true);
  });

  it.each(["22.17.9", "20.0.0", "18.0.0"])("returns false for %s", (version) => {
    expect(satisfiesMinimumNodeVersion(version)).toBe(false);
  });
});

describe("assertNodeSupportsTsConfig", () => {
  it("throws with a clear upgrade-or-switch message for old versions", () => {
    expect(() => assertNodeSupportsTsConfig("22.17.9")).toThrow(formatTsConfigNodeVersionError("22.17.9"));
  });

  it("does not throw for the current process version", () => {
    expect(() => assertNodeSupportsTsConfig()).not.toThrow();
  });
});
