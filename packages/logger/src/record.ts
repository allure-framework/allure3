import type { LogLevel } from "./level.js";
import { applyRedaction, type RedactPath } from "./redact.js";

/** Structured log event emitted to transports. */
export type LogRecord = Record<string, unknown> & {
  /** Severity label. */
  level: LogLevel;
  /** Epoch timestamp in milliseconds. */
  time: number;
  /** Human-readable message, when provided. */
  msg?: string;
};

const RESERVED_RECORD_KEYS = new Set(["level", "time", "msg"]);

const serializeValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value instanceof Error) {
    return {
      type: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const record: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      record[key] = serializeValue(entry, seen);
    }

    return record;
  }

  return value;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  const serialized = serializeValue(value);

  if (!serialized || typeof serialized !== "object" || Array.isArray(serialized)) {
    return {};
  }

  return serialized as Record<string, unknown>;
};

const omitReservedKeys = (record: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(record)) {
    if (!RESERVED_RECORD_KEYS.has(key)) {
      result[key] = entry;
    }
  }

  return result;
};

/**
 * Builds a structured log record from bindings, payload, and redaction rules.
 *
 * Supports call shapes: `log.info("message")` and `log.info({ key: "value" }, "message")`.
 *
 * @param level - Severity of the log event.
 * @param bindings - Context merged from the logger and its ancestors.
 * @param first - Message string or structured payload object.
 * @param second - Optional message when `first` is an object.
 * @param redactPaths - Compiled redaction rules.
 */
export const buildRecord = (
  level: LogLevel,
  bindings: Record<string, unknown>,
  first: string | Record<string, unknown>,
  second: string | undefined,
  redactPaths: RedactPath[],
): LogRecord => {
  const serializedBindings = omitReservedKeys(toRecord(bindings));
  const payload = typeof first === "string" ? {} : omitReservedKeys(toRecord(first));
  const msg = typeof first === "string" ? first : second;
  const record = {
    ...serializedBindings,
    ...payload,
    level,
    time: Date.now(),
    ...(msg ? { msg } : {}),
  };

  return applyRedaction(record, redactPaths) as LogRecord;
};

/**
 * Serializes a log record to a single NDJSON line.
 *
 * @param record - Structured log event.
 */
export const serializeRecord = (record: LogRecord): string => {
  try {
    return `${JSON.stringify(record)}\n`;
  } catch {
    return `${JSON.stringify({
      level: record.level,
      time: record.time,
      msg: record.msg,
      error: "Failed to serialize log record",
    })}\n`;
  }
};
