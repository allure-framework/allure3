import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LogRecord } from "../src/record.js";
import { consoleTransport, fileTransport } from "../src/transport.js";
import { applyLoggerMetadata } from "./helpers.js";

beforeEach(async () => {
  await applyLoggerMetadata("transport");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const sampleRecord = (): LogRecord => ({
  level: "info",
  time: 1_719_158_400_123,
  name: "allure",
  msg: "started",
});

describe("consoleTransport", () => {
  it("writes the pre-serialized NDJSON line to stdout by default", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const transport = consoleTransport();
    const line = '{"level":"info","msg":"started"}\n';

    transport(line, sampleRecord());

    expect(write, "default console transport should write the NDJSON line to stdout").toHaveBeenCalledWith(line);
  });

  it("writes human-readable output when pretty mode is enabled", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const transport = consoleTransport({ pretty: true });

    transport('{"level":"info"}\n', sampleRecord());

    expect(write, "pretty mode should include the uppercased level label").toHaveBeenCalledWith(
      expect.stringContaining("INFO"),
    );
    expect(write, "pretty mode should include the log message").toHaveBeenCalledWith(expect.stringContaining("started"));
  });

  it("routes error levels to stderr in auto destination mode", () => {
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const transport = consoleTransport();
    const record: LogRecord = { ...sampleRecord(), level: "error" };

    transport('{"level":"error"}\n', record);

    expect(write, "error levels should be routed to stderr in auto mode").toHaveBeenCalled();
  });
});

describe("fileTransport", () => {
  it("appends NDJSON lines and flushes on close", async () => {
    const dir = await mkdtemp(join(tmpdir(), "allure-logger-"));
    const path = join(dir, "app.log");
    const transport = fileTransport({ path });
    const line = '{"level":"info","msg":"started"}\n';

    transport(line, sampleRecord());
    await transport.close();

    await expect(readFile(path, "utf-8"), "file transport should append NDJSON and flush on close").resolves.toBe(line);
  });

  it.skipIf(process.platform === "win32")("rejects destinations that are not writable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "allure-logger-readonly-"));

    try {
      await chmod(dir, 0o555);
      const transport = fileTransport({ path: join(dir, "app.log") });

      expect(
        () => transport('{"level":"info"}\n', sampleRecord()),
        "non-writable destinations should fail on first write",
      ).toThrow(/cannot write to/);
    } finally {
      await chmod(dir, 0o755).catch(() => undefined);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
