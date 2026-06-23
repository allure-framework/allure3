import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isLevelEnabled, normalizeLevel, resolveLevelFromEnv } from "../src/level.js";
import { applyLoggerMetadata } from "./helpers.js";

beforeEach(async () => {
  await applyLoggerMetadata("level");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeLevel", () => {
  it("maps deprecated verbose alias to trace", () => {
    expect(normalizeLevel("verbose"), "verbose should normalize to trace").toBe("trace");
  });

  it("returns undefined for unknown labels", () => {
    expect(normalizeLevel("loud"), "unknown level labels should normalize to undefined").toBeUndefined();
  });
});

describe("resolveLevelFromEnv", () => {
  it("prefers an explicit level over environment variables", () => {
    vi.stubEnv("LOG_LEVEL", "error");

    expect(resolveLevelFromEnv("trace"), "explicit level should override LOG_LEVEL").toBe("trace");
  });

  it("reads LOG_LEVEL from the environment", () => {
    vi.stubEnv("LOG_LEVEL", "warn");

    expect(resolveLevelFromEnv(), "LOG_LEVEL should be read from the environment").toBe("warn");
  });

  it("reads ALLURE_LOG_LEVEL with verbose alias support", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "verbose");

    expect(resolveLevelFromEnv(), "ALLURE_LOG_LEVEL verbose should resolve to trace").toBe("trace");
  });

  it("defaults to debug in development", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(resolveLevelFromEnv(), "development should default to debug").toBe("debug");
  });

  it("defaults to info outside development", () => {
    expect(resolveLevelFromEnv(), "non-development should default to info").toBe("info");
  });

  it("warns once and falls back when env level is invalid", async () => {
    vi.stubEnv("LOG_LEVEL", "not-a-level");
    vi.resetModules();

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { resolveLevelFromEnv: resolveFresh } = await import("../src/level.js");

    expect(resolveFresh(), "invalid LOG_LEVEL should fall back to info").toBe("info");
    expect(stderr, "invalid LOG_LEVEL should emit a one-time stderr warning").toHaveBeenCalledWith(
      'logger: invalid LOG_LEVEL value "not-a-level", using default level\n',
    );
  });
});

describe("isLevelEnabled", () => {
  it.each([
    { threshold: "info", level: "debug", enabled: false },
    { threshold: "info", level: "info", enabled: true },
    { threshold: "info", level: "error", enabled: true },
    { threshold: "silent", level: "fatal", enabled: false },
  ])("returns $enabled for threshold=$threshold and messageLevel=$level", ({ threshold, level, enabled }) => {
    expect(
      isLevelEnabled(threshold, level),
      `threshold ${threshold} should ${enabled ? "allow" : "block"} level ${level}`,
    ).toBe(enabled);
  });
});
