import * as console from "node:console";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Logger } from "../src/utils/logger.js";

const stripAnsi = (value: string) => value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefixes info messages with the logger name", () => {
    new Logger("AllureRun", "info").info("Attempt started");

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("[AllureRun]:"));
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Attempt started"));
  });

  it("aligns multiline message continuations below the prefix", () => {
    new Logger("QualityGate", "info").info("Fast-fail triggered\nRule: maxFailures");

    const message = vi.mocked(console.info).mock.calls[0]?.[0] as string;

    expect(stripAnsi(message)).toBe(`[QualityGate]: Fast-fail triggered\n${" ".repeat(15)}Rule: maxFailures`);
  });

  it("suppresses messages below the configured level", () => {
    const logger = new Logger("AllureRun", "info");

    logger.debug("Test plan path");
    logger.info("Attempt started");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledTimes(1);
  });

  it("uses ALLURE_LOG_LEVEL when no explicit level is provided", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "debug");

    new Logger("AllureRun").debug("Test plan path");

    expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("Test plan path"));
  });

  it("ignores unsupported environment log levels", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "everything");

    new Logger("AllureRun").info("Attempt started");

    expect(console.info).toHaveBeenCalledTimes(1);
  });

  it("changes the log level at runtime", () => {
    const logger = new Logger("AllureRun", "info");

    logger.debug("Before change");
    logger.setLogLevel("debug");
    logger.debug("After change");

    expect(console.debug).not.toHaveBeenCalledWith(expect.stringContaining("Before change"));
    expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("After change"));
  });
});
