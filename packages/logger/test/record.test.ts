import { beforeEach, describe, expect, it } from "vitest";

import { serializeRecord, type LogRecord } from "../src/record.js";
import { applyLoggerMetadata } from "./helpers.js";

beforeEach(async () => {
  await applyLoggerMetadata("record");
});

describe("serializeRecord", () => {
  it("returns a trailing-newline NDJSON line", () => {
    const line = serializeRecord({ level: "info", time: 1, msg: "ok" });

    expect(line, "serialized records should be NDJSON with a trailing newline").toBe(
      '{"level":"info","time":1,"msg":"ok"}\n',
    );
  });

  it("returns a fallback line when JSON serialization fails", () => {
    const record: LogRecord = { level: "info", time: 1, msg: "ok" };

    record.circular = record;

    const line = serializeRecord(record);

    expect(line, "serialization failures should return a fallback error line").toContain(
      "Failed to serialize log record",
    );
  });
});
