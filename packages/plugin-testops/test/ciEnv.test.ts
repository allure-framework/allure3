import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyAllureCiEnv } from "../src/utils/ciEnv.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("ciEnv");
  await label("coverage", "testops-integration");
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.ALLURE_DECODED_VAR;
  delete process.env.ALLURE_OTHER_DECODED_VAR;
});

const encode = (vars: Record<string, string>): string => Buffer.from(JSON.stringify(vars), "utf8").toString("base64");

describe("applyAllureCiEnv", () => {
  it("does nothing when ALLURE_CI_ENV is not set", () => {
    applyAllureCiEnv();

    expect(process.env.ALLURE_DECODED_VAR).toBeUndefined();
  });

  it("decodes ALLURE_CI_ENV and applies its ALLURE_* entries to process.env", () => {
    vi.stubEnv("ALLURE_CI_ENV", encode({ ALLURE_DECODED_VAR: "from-ci-env" }));

    applyAllureCiEnv();

    expect(process.env.ALLURE_DECODED_VAR).toBe("from-ci-env");
  });

  it("applies every ALLURE_* entry from the bundle", () => {
    vi.stubEnv("ALLURE_CI_ENV", encode({ ALLURE_DECODED_VAR: "one", ALLURE_OTHER_DECODED_VAR: "two" }));

    applyAllureCiEnv();

    expect(process.env.ALLURE_DECODED_VAR).toBe("one");
    expect(process.env.ALLURE_OTHER_DECODED_VAR).toBe("two");
  });

  it("ignores non-ALLURE_ keys in the decoded bundle", () => {
    vi.stubEnv("ALLURE_CI_ENV", encode({ NOT_ALLURE_PREFIXED: "should-be-ignored" }));

    applyAllureCiEnv();

    expect(process.env.NOT_ALLURE_PREFIXED).toBeUndefined();
  });

  it("does not throw and leaves env untouched when ALLURE_CI_ENV is malformed", () => {
    vi.stubEnv("ALLURE_CI_ENV", "not-valid-base64-json");

    expect(() => applyAllureCiEnv()).not.toThrow();
    expect(process.env.ALLURE_DECODED_VAR).toBeUndefined();
  });
});
