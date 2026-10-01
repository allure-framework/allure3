import * as console from "node:console";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { Logger } = await import("../src/logger.js");

vi.mock("node:console", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:console")>();
  const methods = {
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    ...actual,
    ...methods,
    default: {
      ...actual.default,
      ...methods,
    },
  };
});

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should log info messages with prefix", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "info");

    new Logger("TestOpsPlugin").info("Publishing report");

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("[TestOpsPlugin]:"));
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Publishing report"));
  });

  it("should suppress logs below current level", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "info");

    new Logger("TestOpsPlugin").debug("Uploading test results");

    expect(console.debug).not.toHaveBeenCalled();
  });

  it("should suppress logs in silent mode", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "silent");

    new Logger("TestOpsPlugin").warn("Publishing report");

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should prefer the constructor log level over environment variables", () => {
    vi.stubEnv("LOG_LEVEL", "silent");
    vi.stubEnv("ALLURE_LOG_LEVEL", "silent");

    new Logger("TestOpsPlugin", "info").info("Publishing report");

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Publishing report"));
  });

  it("should change the log level at runtime", () => {
    const logger = new Logger("TestOpsPlugin", "info");

    logger.debug("Before change");
    logger.setLogLevel("debug");
    logger.debug("After change");

    expect(console.debug).not.toHaveBeenCalledWith(expect.stringContaining("Before change"));
    expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("After change"));
  });
});
