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
});
