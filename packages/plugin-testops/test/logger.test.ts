import console from "node:console";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ProgressBarMock } = vi.hoisted(() => {
  const mock = vi.fn(function () {
    return {
      tick: vi.fn(),
      update: vi.fn(),
      terminate: vi.fn(),
    };
  });

  return { ProgressBarMock: mock };
});

vi.mock("progress", () => ({
  default: ProgressBarMock,
}));

const { Logger } = await import("../src/logger.js");

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should render counter progress bars at the default info level", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "info");

    new Logger("TestOpsPlugin").progressBarCounter("Publishing report", 3);

    expect(ProgressBarMock).toHaveBeenCalledWith(expect.stringContaining("Publishing report"), {
      total: 3,
      width: 20,
    });
  });

  it("should render percentage progress bars at the default info level", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "info");

    new Logger("TestOpsPlugin").progressBar("Uploading test results");

    expect(ProgressBarMock).toHaveBeenCalledWith(expect.stringContaining("Uploading test results"), {
      total: 100,
      width: 20,
    });
  });

  it("should suppress progress bars when logging is silent", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "silent");

    const progressBar = new Logger("TestOpsPlugin").progressBarCounter("Publishing report", 3);

    progressBar.tick();
    progressBar.terminate();

    expect(ProgressBarMock).not.toHaveBeenCalled();
  });

  it("should stringify array payloads for debug output", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "debug");

    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const payload = [{ id: 1 }, { id: 2 }];

    new Logger("TestOpsPlugin").debug(payload);

    expect(debug).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(payload, null, 2)));
  });

  it("should redact sensitive fields in debug output", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "debug");

    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    new Logger("TestOpsPlugin").debug({ accessToken: "secret-token", ok: true });

    expect(debug, "access tokens should be redacted in debug output").toHaveBeenCalledWith(
      expect.stringContaining("[Redacted]"),
    );
    expect(debug, "raw secrets should not appear in debug output").not.toHaveBeenCalledWith(
      expect.stringContaining("secret-token"),
    );
  });

  it("should redact axios response config when logged", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "debug");

    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const axiosResponse = {
      status: 401,
      data: { message: "unauthorized" },
      config: {
        headers: { Authorization: "api-token secret-token" },
        auth: { username: "demo", password: "secret-password" },
      },
    };

    new Logger("TestOpsPlugin").debug(axiosResponse);

    expect(debug, "axios authorization headers should be redacted").toHaveBeenCalledWith(
      expect.stringContaining("[Redacted]"),
    );
    expect(debug, "axios authorization secrets should not leak").not.toHaveBeenCalledWith(
      expect.stringContaining("secret-token"),
    );
    expect(debug, "axios auth passwords should not leak").not.toHaveBeenCalledWith(
      expect.stringContaining("secret-password"),
    );
  });
});
