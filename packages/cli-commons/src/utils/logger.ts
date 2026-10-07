import console from "node:console";
import { env } from "node:process";
import { inspect as inspectValue } from "node:util";

import { blue, bold, cyan, dim, gray, red, yellow } from "yoctocolors";

export type LogLevel = "silent" | "verbose" | "debug" | "info" | "warn" | "error";

export type LogMessage = string | Record<string, unknown> | unknown[];

const logLevelsPriority: Record<LogLevel, number> = {
  silent: Number.MAX_SAFE_INTEGER,
  verbose: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const isLogLevel = (value: string | undefined): value is LogLevel =>
  value !== undefined && Object.prototype.hasOwnProperty.call(logLevelsPriority, value);

export const getLogLevelFromEnv = (): LogLevel => {
  if (isLogLevel(env.ALLURE_LOG_LEVEL)) {
    return env.ALLURE_LOG_LEVEL;
  }

  if (env.NODE_ENV === "development") {
    return "debug";
  }

  return "info";
};

let globalLogLevel: LogLevel | undefined;

/**
 * Sets the process-wide log level used by every logger that has no explicit level of its own.
 * Takes precedence over `ALLURE_LOG_LEVEL`; pass `undefined` to fall back to the environment again.
 */
export const setGlobalLogLevel = (logLevel: LogLevel | undefined) => {
  globalLogLevel = logLevel;
};

export const getGlobalLogLevel = (): LogLevel | undefined => globalLogLevel;

const stringifyMessage = (message: LogMessage) => {
  if (typeof message === "string") {
    return message;
  }

  try {
    const serialized = JSON.stringify(message, null, 2);

    if (serialized !== undefined) {
      return serialized;
    }
  } catch {}

  try {
    return inspectValue(message, {
      colors: false,
      depth: 4,
      maxArrayLength: 50,
      maxStringLength: 2_000,
    });
  } catch {
    return "[Unable to format log message]";
  }
};

export class Logger {
  readonly #prefix: string;
  readonly #continuationPrefix: string;
  #level: LogLevel | undefined;

  constructor(loggerName: string, logLevel?: LogLevel) {
    const plainPrefix = `[${loggerName}]:`;

    this.#level = logLevel;
    this.#prefix = cyan(bold(plainPrefix));
    this.#continuationPrefix = " ".repeat(plainPrefix.length);
  }

  setLogLevel(logLevel: LogLevel) {
    this.#level = logLevel;
  }

  #isLogLevel(level: LogLevel) {
    const current = this.#level ?? globalLogLevel ?? getLogLevelFromEnv();

    return logLevelsPriority[current] <= logLevelsPriority[level];
  }

  #format(message: LogMessage, color: (value: string) => string) {
    return stringifyMessage(message)
      .split("\n")
      .map((line, index) => `${index === 0 ? this.#prefix : this.#continuationPrefix} ${color(line)}`)
      .join("\n");
  }

  verbose(message: LogMessage) {
    if (this.#isLogLevel("verbose")) {
      console.log(this.#format(message, (line) => dim(gray(line))));
    }
  }

  debug(message: LogMessage) {
    if (this.#isLogLevel("debug")) {
      console.debug(this.#format(message, gray));
    }
  }

  info(message: LogMessage) {
    if (this.#isLogLevel("info")) {
      console.info(this.#format(message, blue));
    }
  }

  warn(message: LogMessage) {
    if (this.#isLogLevel("warn")) {
      console.warn(this.#format(message, yellow));
    }
  }

  error(message: LogMessage) {
    if (this.#isLogLevel("error")) {
      console.error(this.#format(message, red));
    }
  }
}
