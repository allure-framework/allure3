import { accessSync, constants, createWriteStream, existsSync, mkdirSync, type WriteStream } from "node:fs";
import { dirname } from "node:path";
import { stderr, stdout } from "node:process";

import type { LogLevel } from "./level.js";
import type { LogRecord } from "./record.js";

/**
 * Receives a pre-serialized NDJSON line and the structured record.
 *
 * @param line - Serialized NDJSON line, including trailing newline.
 * @param record - Structured log event.
 */
export type Transport = (line: string, record: LogRecord) => void | Promise<void>;

/** Options for the built-in console transport. */
export type ConsoleTransportOptions = {
  /** When `true`, writes a human-readable line instead of raw JSON. */
  pretty?: boolean;
  /** Output stream selection; `auto` routes errors to stderr. */
  destination?: "auto" | "stdout" | "stderr";
};

const stderrLevels: LogLevel[] = ["error", "fatal"];

const pickStream = (level: LogLevel, destination: ConsoleTransportOptions["destination"]) => {
  if (destination === "stdout") {
    return stdout;
  }

  if (destination === "stderr") {
    return stderr;
  }

  return stderrLevels.includes(level) ? stderr : stdout;
};

const assertPathWritable = (path: string): void => {
  const directory = dirname(path);

  try {
    accessSync(directory, constants.W_OK);
    if (existsSync(path)) {
      accessSync(path, constants.W_OK);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`logger file transport cannot write to ${path}: ${reason}`);
  }
};

const formatPretty = (record: LogRecord): string => {
  const { level, time, msg, name, ...rest } = record;
  const prefix = name ? `[${String(name)}] ` : "";
  const details = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";

  return `${String(level).toUpperCase()} ${new Date(time).toISOString()} ${prefix}${msg ?? ""}${details}\n`;
};

/**
 * Creates a transport that writes logs to stdout or stderr.
 *
 * @param options - Console formatting and destination options.
 */
export const consoleTransport = (options: ConsoleTransportOptions = {}): Transport => {
  const { pretty = false, destination = "auto" } = options;

  return (line, record) => {
    const output = pretty ? formatPretty(record) : line;
    const stream = pickStream(record.level, destination);

    stream.write(output);
  };
};

/** File transport with an explicit shutdown hook. */
export type FileTransport = Transport & {
  /**
   * Closes the underlying write stream.
   *
   * @returns Promise that resolves when buffered data has been flushed.
   */
  close: () => Promise<void>;
};

/**
 * Creates a buffered NDJSON file transport.
 *
 * Writes are buffered by Node.js; `write()` may return `false` when the internal buffer
 * is full. High-throughput callers should handle backpressure or batch writes.
 *
 * @param options.path - Destination file path; parent directories are created as needed.
 */
export const fileTransport = (options: { path: string }): FileTransport => {
  let stream: WriteStream | undefined;

  const getStream = () => {
    if (!stream) {
      mkdirSync(dirname(options.path), { recursive: true });
      assertPathWritable(options.path);
      stream = createWriteStream(options.path, { flags: "a" });
      stream.on("error", (error) => {
        process.stderr.write(`logger file transport failed: ${error.message}\n`);
      });
    }

    return stream;
  };

  const write: Transport = (line) => {
    getStream().write(line);
  };

  const transport = Object.assign(write, {
    close: (): Promise<void> => {
      if (!stream) {
        return Promise.resolve();
      }

      const current = stream;

      stream = undefined;

      return new Promise((resolve, reject) => {
        current.once("finish", resolve);
        current.once("error", reject);
        current.end();
      });
    },
  });

  return transport;
};
