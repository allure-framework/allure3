import { resolveLevelFromEnv } from "./level.js";
import { Logger, type LoggerOptions } from "./logger.js";
import { consoleTransport } from "./transport.js";

/**
 * Creates a logger with environment-aware defaults.
 *
 * When `transports` are omitted, logs are written to the console as NDJSON.
 *
 * @param options - Logger configuration.
 */
export const createLogger = (options: LoggerOptions = {}): Logger => {
  const level = resolveLevelFromEnv(options.level);
  const transports = options.transports ?? [consoleTransport()];

  return new Logger({
    ...options,
    level,
    transports,
  });
};
