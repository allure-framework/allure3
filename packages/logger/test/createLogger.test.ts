import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/create.js";
import type { Transport } from "../src/transport.js";
import { applyLoggerMetadata, createCaptureTransport } from "./helpers.js";

beforeEach(async () => {
  await applyLoggerMetadata("createLogger");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createLogger", () => {
  it("suppresses events below the configured threshold", () => {
    const { lines, transport } = createCaptureTransport();
    const log = createLogger({ level: "info", transports: [transport] });

    log.debug("hidden");
    log.info("visible");

    expect(lines, "only logs at or above the configured level should be emitted").toHaveLength(1);
    expect(lines[0], "the emitted line should contain the visible message").toContain("visible");
  });

  it("merges child bindings into emitted records", () => {
    const { records, transport } = createCaptureTransport();
    const log = createLogger({ name: "parent", level: "trace", transports: [transport] });

    log.child({ requestId: "abc" }).info("done");

    expect(records[0], "child bindings should merge into the emitted record").toMatchObject({
      name: "parent",
      requestId: "abc",
      msg: "done",
    });
  });

  it("applies configured redact paths to structured payloads", () => {
    const { records, transport } = createCaptureTransport();
    const log = createLogger({
      level: "info",
      redact: ["password", "req.headers.authorization", "*.token"],
      transports: [transport],
    });

    log.info(
      {
        password: "secret",
        req: { headers: { authorization: "Bearer x" } },
        nested: { token: "t" },
      },
      "login",
    );

    expect(records[0], "configured redact paths should replace sensitive values").toMatchObject({
      password: "[Redacted]",
      req: { headers: { authorization: "[Redacted]" } },
      nested: { token: "[Redacted]" },
      msg: "login",
    });
  });

  it("serializes Error values in structured payloads", () => {
    const { records, transport } = createCaptureTransport();
    const log = createLogger({ level: "error", transports: [transport] });
    const error = new Error("boom");

    log.error({ err: error }, "failed");

    expect(records[0]?.err, "Error values should serialize to type, message, and stack").toEqual({
      type: "Error",
      message: "boom",
      stack: error.stack,
    });
  });

  it("stringifies each record only once for multiple transports", () => {
    const stringify = vi.spyOn(JSON, "stringify");
    const transport: Transport = () => {};
    const log = createLogger({ level: "info", transports: [transport, transport, transport] });

    log.info("once");

    const recordCalls = stringify.mock.calls.filter(([value]) => {
      return typeof value === "object" && value !== null && "level" in value;
    });

    expect(recordCalls, "multiple transports should share one JSON.stringify per log event").toHaveLength(1);
  });

  it("exposes threshold checks through isLevelEnabled", () => {
    const log = createLogger({ level: "warn" });

    expect(log.isLevelEnabled("info"), "levels below warn should be disabled").toBe(false);
    expect(log.isLevelEnabled("error"), "levels at or above warn should be enabled").toBe(true);
  });

  it("respects silent level from the environment", () => {
    vi.stubEnv("ALLURE_LOG_LEVEL", "silent");

    const { lines, transport } = createCaptureTransport();
    const log = createLogger({ transports: [transport] });

    log.fatal("hidden");

    expect(lines, "silent level should suppress all log output").toHaveLength(0);
  });

  it("reports async transport failures without breaking the caller", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const transport: Transport = () => Promise.reject(new Error("async failed"));
    const log = createLogger({ level: "info", transports: [transport] });

    log.info("hello");

    await vi.waitFor(() => {
      expect(stderr, "async transport rejections should be reported to stderr").toHaveBeenCalledWith(
        "logger transport failed: async failed\n",
      );
    });
  });

  it("does not mutate shared bindings when redaction runs", () => {
    const secret = { token: "secret" };
    const bindings = { session: secret };
    const { records, transport } = createCaptureTransport();
    const log = createLogger({
      level: "info",
      bindings,
      redact: ["*.token"],
      transports: [transport],
    });

    log.info("login");

    expect(records[0]?.session, "emitted records should contain redacted binding values").toEqual({
      token: "[Redacted]",
    });
    expect(secret.token, "shared binding objects should remain unchanged after redaction").toBe("secret");
  });

  it("serializes bindings and drops reserved payload keys", () => {
    const { records, transport } = createCaptureTransport();
    const error = new Error("binding-error");
    const log = createLogger({
      level: "info",
      bindings: { err: error },
      transports: [transport],
    });

    log.info({ level: "hijack", time: 0, msg: "ignored", data: "ok" });

    const record = records[0];

    expect(
      {
        level: record?.level,
        data: record?.data,
        err: record?.err,
        timeIsNumber: typeof record?.time === "number",
        hasHijackKey: record ? "hijack" in record : true,
      },
      "bindings should serialize and reserved payload keys should not override record fields",
    ).toEqual({
      level: "info",
      data: "ok",
      err: { type: "Error", message: "binding-error", stack: error.stack },
      timeIsNumber: true,
      hasHijackKey: false,
    });
  });

  it("serializes circular payload references safely", () => {
    const { records, transport } = createCaptureTransport();
    const log = createLogger({ level: "info", transports: [transport] });
    const payload: Record<string, unknown> = { name: "loop" };

    payload.self = payload;

    log.info(payload);

    expect(records[0]?.self, "circular references should serialize as [Circular]").toBe("[Circular]");
  });
});
