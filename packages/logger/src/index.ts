/**
 * Structured logger package for Allure.
 *
 * @packageDocumentation
 */

export { createLogger } from "./create.js";
export { LOG_LEVELS, LEVEL_VALUES, isLevelEnabled, isLogLevel, normalizeLevel, resolveLevelFromEnv } from "./level.js";
export type { LogLevel } from "./level.js";
export { Logger } from "./logger.js";
export type { LoggerOptions } from "./logger.js";
export { compileRedactPaths, applyRedaction } from "./redact.js";
export type { RedactPath } from "./redact.js";
export { buildRecord, serializeRecord } from "./record.js";
export type { LogRecord } from "./record.js";
export { consoleTransport, fileTransport } from "./transport.js";
export type { ConsoleTransportOptions, FileTransport, Transport } from "./transport.js";
