import { env } from "node:process";

/** Supported log level labels */
export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

/** Log level label. */
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Numeric priority for each log level; higher values are more severe. */
export const LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
};

const LEVEL_ALIASES: Record<string, LogLevel> = {
  verbose: "trace",
};

let warnedInvalidLevel = false;

const warnInvalidLevel = (key: string, raw: string): void => {
  if (warnedInvalidLevel) {
    return;
  }

  warnedInvalidLevel = true;
  process.stderr.write(`logger: invalid ${key} value "${raw}", using default level\n`);
};

/**
 * Returns whether the given string is a supported log level.
 *
 * @param value - Candidate level label.
 */
export const isLogLevel = (value: string): value is LogLevel => {
  return (LOG_LEVELS as readonly string[]).includes(value);
};

/**
 * Normalizes a level string, including deprecated aliases such as `verbose` → `trace`.
 *
 * @param value - Raw level label from configuration or environment.
 * @returns Normalized level, or `undefined` when the value is not recognized.
 */
export const normalizeLevel = (value: string): LogLevel | undefined => {
  const normalized = LEVEL_ALIASES[value] ?? value;

  return isLogLevel(normalized) ? normalized : undefined;
};

/**
 * Returns whether a message at `level` should be emitted for the given threshold.
 *
 * @param threshold - Minimum enabled level configured on the logger.
 * @param level - Level of the message being written.
 */
export const isLevelEnabled = (threshold: LogLevel, level: LogLevel): boolean => {
  return LEVEL_VALUES[level] >= LEVEL_VALUES[threshold];
};

/**
 * Resolves the active log level from explicit options and environment variables.
 *
 * Priority: explicit option → `LOG_LEVEL` → `ALLURE_LOG_LEVEL` → `debug` in development → `info`.
 *
 * @param explicit - Level passed directly to `createLogger`.
 */
export const resolveLevelFromEnv = (explicit?: LogLevel): LogLevel => {
  if (explicit) {
    return explicit;
  }

  for (const key of ["LOG_LEVEL", "ALLURE_LOG_LEVEL"] as const) {
    const raw = env[key];

    if (raw) {
      const level = normalizeLevel(raw);

      if (level) {
        return level;
      }

      warnInvalidLevel(key, raw);
    }
  }

  if (env.NODE_ENV === "development") {
    return "debug";
  }

  return "info";
};
