import { describe, expect, it } from "vite-plus/test";

import { normalizeHttpExchangePayload } from "../src/httpAttachments.js";

describe("normalizeHttpExchangePayload", () => {
  it("normalizes nested exchange data while preserving redaction markers and the source", () => {
    const payload = {
      start: "100",
      stop: 125,
      request: {
        method: " post ",
        url: " /upload ",
        headers: [{ name: " Content-Type ", value: "multipart/form-data" }],
        query: [{ name: "q", value: 0 }, null, {}],
        cookies: [{ name: "sid", value: "__ALLURE_REDACTED__", maxAge: "60", httpOnly: true, secure: "true" }],
        body: {
          form: [{ name: "token", value: "__ALLURE_REDACTED__" }],
          parts: [
            {
              name: " file ",
              headers: [{ name: "CONTENT-TYPE", value: "text/plain" }],
              value: "",
              encoding: " UTF8 ",
              size: "0",
              truncated: true,
            },
          ],
          stream: { type: " sse ", complete: false, chunkCount: "2" },
        },
        trailers: [{ name: "checksum", value: "abc" }],
      },
      response: {
        status: 200,
        statusText: " OK ",
        informationalResponses: [
          null,
          { status: 103, statusText: " Early Hints ", headers: [{ name: "link", value: "</style.css>" }] },
        ],
      },
      error: { name: " Error ", message: " failed ", stack: " trace " },
    };
    const original = structuredClone(payload);
    const normalized = normalizeHttpExchangePayload(payload);

    expect(normalized).toMatchObject({
      durationMs: "25 ms",
      request: {
        method: "POST",
        url: "/upload",
        query: [{ name: "q", value: "0", masked: false }],
        cookies: [
          { name: "sid", value: "__ALLURE_REDACTED__", masked: true, maxAge: 60, httpOnly: true, secure: false },
        ],
        body: {
          contentType: "multipart/form-data",
          hasValue: false,
          form: [{ name: "token", value: "__ALLURE_REDACTED__", masked: true }],
          parts: [
            {
              name: "file",
              contentType: "text/plain",
              encoding: "utf8",
              value: "",
              hasValue: true,
              size: 0,
              truncated: true,
            },
          ],
          stream: { type: "sse", complete: "false", chunkCount: 2 },
        },
        trailers: [{ name: "checksum", value: "abc", masked: false }],
      },
      response: {
        status: "200",
        reason: "OK",
        informationalResponses: [
          { status: "103", reason: "Early Hints", headers: [{ name: "link", value: "</style.css>", masked: false }] },
        ],
      },
      error: { name: "Error", message: "failed", stack: "trace" },
    });
    expect(normalized.request?.query).toHaveLength(1);
    expect(normalized.response?.informationalResponses).toHaveLength(1);
    expect(payload).toEqual(original);
  });

  it("rejects malformed records and preserves empty, absent, and binary bodies", () => {
    const empty = { request: null, response: null, error: null, durationMs: "" };
    for (const payload of [null, undefined, [], "invalid", 1, { request: [], response: false, error: {} }]) {
      expect(normalizeHttpExchangePayload(payload)).toEqual(empty);
    }
    expect(normalizeHttpExchangePayload({ request: {} }).request).toMatchObject({ method: "GET", body: null });
    for (const value of [null, undefined, "", 0, false]) {
      expect(normalizeHttpExchangePayload({ request: { body: { value } } }).request?.body).toMatchObject({
        value: value == null ? "" : String(value),
        hasValue: value != null,
        encoding: "utf8",
      });
    }
    expect(
      normalizeHttpExchangePayload({
        response: {
          headers: [{ name: "content-type", value: "image/png" }],
          body: { value: "AA==", encoding: " BASE64 ", size: "1", stream: { chunkCount: "invalid" } },
        },
      }).response?.body,
    ).toMatchObject({
      contentType: "image/png",
      value: "AA==",
      encoding: "base64",
      size: 1,
      stream: { chunkCount: undefined },
    });
  });

  it.each([
    [0, 0, "0 ms"],
    ["10", "12.5", "2.5 ms"],
    [2, 1, ""],
    [undefined, 1, ""],
    [null, 1, ""],
    ["", 1, ""],
    [NaN, 1, ""],
    [0, Infinity, ""],
  ])("formats duration for start=%s and stop=%s", (start, stop, durationMs) => {
    expect(normalizeHttpExchangePayload({ start, stop }).durationMs).toBe(durationMs);
  });
});
