import console from "node:console";

import {
  createLogger,
  Logger as CoreLogger,
  type LogLevel,
  type LogRecord,
  type Transport,
} from "@allurereport/logger";
import ProgressBar from "progress";
import { blue, bold, cyan, dim, gray, red, yellow } from "yoctocolors";

type LogMessage = string | Record<string, unknown> | Array<unknown>;

const TESTOPS_REDACT_PATHS = [
  "password",
  "secret",
  "authorization",
  "accessToken",
  "apiToken",
  "*.token",
  "*.password",
  "*.secret",
  "req.headers.authorization",
] as const;

const formatMessage = (record: LogRecord): string => {
  const { msg, name: _name, level: _level, time: _time, ...rest } = record;
  const keys = Object.keys(rest);

  if (keys.length === 0) {
    return msg ?? "";
  }

  const payload = JSON.stringify(rest, null, 2);

  return msg ? `${msg}\n${payload}` : payload;
};

const styleByLevel = (level: LogLevel, message: string): string => {
  switch (level) {
    case "trace":
      return dim(gray(message));
    case "debug":
      return gray(message);
    case "info":
      return blue(message);
    case "warn":
      return yellow(message);
    case "error":
    case "fatal":
      return red(message);
    default:
      return message;
  }
};

const writeByLevel = (level: LogLevel, message: string): void => {
  switch (level) {
    case "debug":
    case "trace":
      console.debug(message);
      break;
    case "info":
      console.info(message);
      break;
    case "warn":
      console.warn(message);
      break;
    case "error":
    case "fatal":
      console.error(message);
      break;
    default:
      console.log(message);
  }
};

type LogPayload = string | Record<string, unknown>;
type WritableLevel = Exclude<LogLevel, "silent">;

const normalizeMessage = (message: LogMessage): LogPayload => {
  if (Array.isArray(message)) {
    return JSON.stringify(message, null, 2);
  }

  return message;
};

export class Logger {
  readonly #log: CoreLogger;
  readonly #prefix;

  constructor(readonly name: string) {
    this.#prefix = cyan(bold(`[${name}]:`));
    this.#log = createLogger({
      name,
      redact: [...TESTOPS_REDACT_PATHS],
      transports: [this.#createTransport()],
    });
  }

  #createTransport(): Transport {
    return (_line: string, record: LogRecord) => {
      const message = styleByLevel(record.level, formatMessage(record));

      writeByLevel(record.level, `${this.#prefix} ${message}`);
    };
  }

  #isSilent() {
    return !this.#log.isLevelEnabled("fatal");
  }

  progressBarCounter(message: string, total: number) {
    if (this.#isSilent()) {
      return {
        tick: () => {},
        update: () => {},
        terminate: () => {},
      };
    }

    return new ProgressBar(`${this.#prefix} ${blue(message)} [:bar] :current/:total`, {
      total,
      width: 20,
    });
  }

  progressBar(message: string) {
    if (this.#isSilent()) {
      return {
        update: () => {},
        terminate: () => {},
      };
    }

    return new ProgressBar(`${this.#prefix} ${blue(message)} [:bar] :percent`, {
      total: 100,
      width: 20,
    });
  }

  #write(level: WritableLevel, message: LogMessage) {
    this.#log[level](normalizeMessage(message));
  }

  trace(message: LogMessage) {
    this.#write("trace", message);
  }

  debug(message: LogMessage) {
    this.#write("debug", message);
  }

  newLine() {
    console.log("\n");
  }

  info(message: LogMessage) {
    this.#write("info", message);
  }

  warn(message: LogMessage) {
    this.#write("warn", message);
  }

  error(message: LogMessage) {
    this.#write("error", message);
  }

  fatal(message: LogMessage) {
    this.#write("fatal", message);
  }

  inspect(value: unknown) {
    if (!this.#log.isLevelEnabled("debug")) {
      return;
    }

    this.#log.debug({ value }, "inspect");
  }
}
