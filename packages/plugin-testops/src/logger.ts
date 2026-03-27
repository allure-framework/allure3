import console from "node:console";
import { env } from "node:process";
import { inspect } from "node:util";

import ProgressBar from "progress";
import { blue, bold, cyan, dim, gray, red, yellow } from "yoctocolors";

type LogLevel = "silent" | "verbose" | "debug" | "info" | "warn" | "error";

type JSONMessage = Record<string, unknown> | Array<unknown>;

const logLevelsPriority = {
  silent: Number.MAX_SAFE_INTEGER,
  verbose: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
} as const;

function getLogLevelFromEnv(): LogLevel {
  if (env.LOG_LEVEL) {
    return env.LOG_LEVEL as LogLevel;
  }

  if (env.ALLURE_LOG_LEVEL) {
    return env.ALLURE_LOG_LEVEL as LogLevel;
  }

  if (env.CI) {
    return "info";
  }

  if (env.NODE_ENV === "development") {
    return "debug";
  }

  return "info";
}

export class Logger {
  #level: LogLevel = getLogLevelFromEnv();
  constructor(readonly name: string) {}

  #isLogLevel(level: LogLevel) {
    return logLevelsPriority[this.#level] <= logLevelsPriority[level];
  }

  #prefix = cyan(bold(`[${this.name}]:`));

  progressBarCounter(message: string, total: number) {
    if (this.#isLogLevel("silent")) {
      return {
        tick: () => {},
        update: () => {},
        terminate: () => {},
      };
    }

    const progressBar = new ProgressBar(`${this.#prefix} ${blue(message)} [:bar] :current/:total`, {
      total,
      width: 20,
    });

    return progressBar;
  }
  progressBar(message: string) {
    if (this.#isLogLevel("silent")) {
      return {
        update: () => {},
        terminate: () => {},
      };
    }

    const progressBar = new ProgressBar(`${this.#prefix} ${blue(message)} [:bar] :percent`, {
      total: 100,
      width: 20,
    });
    return progressBar;
  }

  verbose(message: string | JSONMessage) {
    if (!this.#isLogLevel("verbose")) {
      return;
    }

    if (typeof message === "string") {
      console.log(`${this.#prefix} ${dim(gray(message))}`);
      return;
    }

    console.log(`${this.#prefix} ${dim(gray(JSON.stringify(message, null, 2)))}`);
  }

  debug(message: string | JSONMessage) {
    if (!this.#isLogLevel("debug")) {
      return;
    }

    if (typeof message === "string") {
      console.debug(`${this.#prefix} ${gray(message)}`);
      return;
    }

    console.debug(`${this.#prefix} ${gray(JSON.stringify(message, null, 2))}`);
  }

  newLine() {
    console.log("\n");
  }

  info(message: string | JSONMessage) {
    if (!this.#isLogLevel("info")) {
      return;
    }

    if (typeof message === "string") {
      console.info(`${this.#prefix} ${blue(message)}`);
      return;
    }

    console.info(`${this.#prefix} ${blue(JSON.stringify(message, null, 2))}`);
  }

  warn(message: string | JSONMessage) {
    if (!this.#isLogLevel("warn")) {
      return;
    }

    if (typeof message === "string") {
      console.warn(`${this.#prefix} ${yellow(message)}`);
      return;
    }

    console.warn(`${this.#prefix} ${yellow(JSON.stringify(message, null, 2))}`);
  }

  error(message: string | JSONMessage) {
    if (!this.#isLogLevel("error")) {
      return;
    }

    if (typeof message === "string") {
      console.error(`${this.#prefix} ${red(message)}`);
      return;
    }

    console.error(`${this.#prefix} ${red(JSON.stringify(message, null, 2))}`);
  }

  inspect(value: unknown) {
    if (!this.#isLogLevel("debug")) {
      return;
    }

    console.log(`${this.#prefix} inspect`);
    inspect(value);
  }
}
