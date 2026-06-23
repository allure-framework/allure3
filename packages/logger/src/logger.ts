import { isLevelEnabled, type LogLevel } from "./level.js";
import { compileRedactPaths, type RedactPath } from "./redact.js";
import { buildRecord, serializeRecord, type LogRecord } from "./record.js";
import type { Transport } from "./transport.js";

/** Configuration for creating a logger instance. */
export type LoggerOptions = {
  /** Logger name added to every record as `name`. */
  name?: string;
  /** Minimum enabled level; defaults to environment resolution in `createLogger`. */
  level?: LogLevel;
  /** Base context fields merged into every record. */
  bindings?: Record<string, unknown>;
  /** Redact path patterns compiled at construction time. */
  redact?: string[];
  /** Pre-compiled redaction rules, usually for child loggers. */
  redactPaths?: RedactPath[];
  /** Output sinks invoked for each enabled log line. */
  transports?: Transport[];
};

type WritableLevel = Exclude<LogLevel, "silent">;

/**
 * Structured logger with level gating, child bindings, and pluggable transports.
 */
export class Logger {
  readonly #level: LogLevel;
  readonly #bindings: Record<string, unknown>;
  readonly #redactPaths: RedactPath[];
  readonly #transports: Transport[];

  /**
   * Creates a logger instance.
   *
   * Prefer `createLogger` for environment-aware defaults.
   *
   * @param options - Logger configuration.
   */
  constructor(options: LoggerOptions) {
    this.#level = options.level ?? "info";
    this.#bindings = {
      ...(options.name ? { name: options.name } : {}),
      ...options.bindings,
    };
    this.#redactPaths = options.redactPaths ?? compileRedactPaths(options.redact ?? []);
    this.#transports = options.transports ?? [];
  }

  /**
   * Creates a child logger with additional bound context.
   *
   * @param bindings - Context fields merged into every child record.
   */
  child(bindings: Record<string, unknown>): Logger {
    return new Logger({
      level: this.#level,
      bindings: { ...this.#bindings, ...bindings },
      redactPaths: this.#redactPaths,
      transports: this.#transports,
    });
  }

  /**
   * Returns whether logs at the given level would be emitted.
   *
   * Use before building expensive payloads.
   *
   * @param level - Candidate log level.
   */
  isLevelEnabled(level: LogLevel): boolean {
    return isLevelEnabled(this.#level, level);
  }

  /**
   * Writes a trace-level log event.
   *
   * @param first - Message string or structured payload.
   * @param second - Optional message when `first` is an object.
   */
  trace(first: string | Record<string, unknown>, second?: string): void {
    this.#emit("trace", first, second);
  }

  /**
   * Writes a debug-level log event.
   *
   * @param first - Message string or structured payload.
   * @param second - Optional message when `first` is an object.
   */
  debug(first: string | Record<string, unknown>, second?: string): void {
    this.#emit("debug", first, second);
  }

  /**
   * Writes an info-level log event.
   *
   * @param first - Message string or structured payload.
   * @param second - Optional message when `first` is an object.
   */
  info(first: string | Record<string, unknown>, second?: string): void {
    this.#emit("info", first, second);
  }

  /**
   * Writes a warn-level log event.
   *
   * @param first - Message string or structured payload.
   * @param second - Optional message when `first` is an object.
   */
  warn(first: string | Record<string, unknown>, second?: string): void {
    this.#emit("warn", first, second);
  }

  /**
   * Writes an error-level log event.
   *
   * @param first - Message string or structured payload.
   * @param second - Optional message when `first` is an object.
   */
  error(first: string | Record<string, unknown>, second?: string): void {
    this.#emit("error", first, second);
  }

  /**
   * Writes a fatal-level log event.
   *
   * @param first - Message string or structured payload.
   * @param second - Optional message when `first` is an object.
   */
  fatal(first: string | Record<string, unknown>, second?: string): void {
    this.#emit("fatal", first, second);
  }

  #emit(level: WritableLevel, first: string | Record<string, unknown>, second?: string): void {
    this.#write(level, first, second);
  }

  #write(level: LogLevel, first: string | Record<string, unknown>, second?: string): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const record = buildRecord(level, this.#bindings, first, second, this.#redactPaths);
    const line = serializeRecord(record);

    for (const transport of this.#transports) {
      this.#invokeTransport(transport, line, record);
    }
  }

  #invokeTransport(transport: Transport, line: string, record: LogRecord): void {
    try {
      const result = transport(line, record);

      if (result instanceof Promise) {
        void result.catch((error) => {
          this.#reportTransportFailure(error);
        });
      }
    } catch (error) {
      this.#reportTransportFailure(error);
    }
  }

  #reportTransportFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);

    process.stderr.write(`logger transport failed: ${message}\n`);
  }
}
