import * as console from "node:console";

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { Logger, setGlobalLogLevel, type LogLevel } from "../src/utils/logger.js";

const stripAnsi = (value: string) => value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");

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
    setGlobalLogLevel(undefined);
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

  it("ignores the generic LOG_LEVEL environment variable", () => {
    vi.stubEnv("LOG_LEVEL", "silent");

    new Logger("AllureRun").info("Attempt started");

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Attempt started"));
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

  it("applies the global log level to loggers created before it was set", () => {
    const logger = new Logger("AllureRun");

    setGlobalLogLevel("error");
    logger.info("Hidden");
    logger.error("Shown");

    expect(console.info).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Shown"));
  });

  it("lets the global log level win over ALLURE_LOG_LEVEL", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "debug");
    setGlobalLogLevel("verbose");

    new Logger("AllureRun").verbose("Details");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Details"));

    setGlobalLogLevel("error");
    new Logger("AllureRun").debug("Hidden");
    expect(console.debug).not.toHaveBeenCalled();
  });

  it("keeps an explicit logger level over the global one", () => {
    setGlobalLogLevel("error");

    new Logger("AllureRun", "info").info("Explicit");

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("Explicit"));
  });

  it("falls back to bounded inspection for circular objects", () => {
    const message: Record<string, unknown> = {
      name: "circular",
    };

    message.self = message;

    expect(() => new Logger("AllureRun", "info").info(message)).not.toThrow();

    const logged = vi.mocked(console.info).mock.calls[0]?.[0] as string;

    expect(stripAnsi(logged)).toContain("name: 'circular'");
    expect(stripAnsi(logged)).toContain("[Circular");
  });

  it.each<[LogLevel, { [k in LogLevel]?: boolean }, boolean]>([
    ["silent", {}, false],
    ["error", { error: true }, true],
    ["warn", { error: true, warn: true }, true],
    ["info", { error: true, warn: true, info: true }, true],
    ["debug", { error: true, warn: true, info: true, debug: true }, true],
    ["verbose", { error: true, warn: true, info: true, debug: true, verbose: true }, true],
  ])(
    "set level flags from %s global level",
    (level: LogLevel, { error = false, warn = false, info = false, debug = false, verbose = false }, enabled) => {
      vi.stubEnv("ALLURE_LOG_LEVEL", level);

      const logger = new Logger("AllureRun");

      expect(logger.enabled).toBe(enabled);
      expect(logger.errorEnabled).toBe(error);
      expect(logger.warnEnabled).toBe(warn);
      expect(logger.infoEnabled).toBe(info);
      expect(logger.debugEnabled).toBe(debug);
      expect(logger.verboseEnabled).toBe(verbose);
    },
  );

  it.each<[LogLevel, { [k in LogLevel]?: boolean }, boolean]>([
    ["silent", {}, false],
    ["error", { error: true }, true],
    ["warn", { error: true, warn: true }, true],
    ["info", { error: true, warn: true, info: true }, true],
    ["debug", { error: true, warn: true, info: true, debug: true }, true],
    ["verbose", { error: true, warn: true, info: true, debug: true, verbose: true }, true],
  ])(
    "set level flags from %s constructor level",
    (level: LogLevel, { error = false, warn = false, info = false, debug = false, verbose = false }, enabled) => {
      const logger = new Logger("AllureRun", level);

      expect(logger.enabled).toBe(enabled);
      expect(logger.errorEnabled).toBe(error);
      expect(logger.warnEnabled).toBe(warn);
      expect(logger.infoEnabled).toBe(info);
      expect(logger.debugEnabled).toBe(debug);
      expect(logger.verboseEnabled).toBe(verbose);
    },
  );

  it.each<[LogLevel, { [k in LogLevel]?: boolean }, boolean]>([
    ["silent", {}, false],
    ["error", { error: true }, true],
    ["warn", { error: true, warn: true }, true],
    ["info", { error: true, warn: true, info: true }, true],
    ["debug", { error: true, warn: true, info: true, debug: true }, true],
    ["verbose", { error: true, warn: true, info: true, debug: true, verbose: true }, true],
  ])(
    "set level flags from setLogLevel(%s)",
    (level: LogLevel, { error = false, warn = false, info = false, debug = false, verbose = false }, enabled) => {
      const logger = new Logger("AllureRun");

      logger.setLogLevel(level);

      expect(logger.enabled).toBe(enabled);
      expect(logger.errorEnabled).toBe(error);
      expect(logger.warnEnabled).toBe(warn);
      expect(logger.infoEnabled).toBe(info);
      expect(logger.debugEnabled).toBe(debug);
      expect(logger.verboseEnabled).toBe(verbose);
    },
  );

  it("set level flags from global level", () => {
    const logger = new Logger("AllureRun");

    logger.debug("Test plan path");
    logger.info("Attempt started");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledTimes(1);
  });
});
