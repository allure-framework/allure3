import console from "node:console";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { Logger } = await import("../src/logger.js");

describe("Logger", () => {
  let info: any;
  let debug: any;
  let warn: any;
  let error: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    info = vi.spyOn(console, "info");
    debug = vi.spyOn(console, "debug");
    warn = vi.spyOn(console, "warn");
    error = vi.spyOn(console, "error");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should log info messages with prefix", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "info");

    new Logger("TestOpsPlugin").info("Publishing report");

    expect(info).toHaveBeenCalledWith(expect.stringContaining("[TestOpsPlugin]:"));
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Publishing report"));
  });

  it("should suppress logs below current level", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "info");

    new Logger("TestOpsPlugin").debug("Uploading test results");

    expect(debug).not.toHaveBeenCalled();
  });

  it("should suppress logs in silent mode", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "silent");

    new Logger("TestOpsPlugin").warn("Publishing report");

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
