import { beforeEach, describe, expect, it } from "vitest";

import { applyRedaction, compileRedactPaths } from "../src/redact.js";
import { applyLoggerMetadata } from "./helpers.js";

beforeEach(async () => {
  await applyLoggerMetadata("redact");
});

describe("compileRedactPaths and applyRedaction", () => {
  it("redacts a top-level key", () => {
    const paths = compileRedactPaths(["password"]);
    const result = applyRedaction({ password: "secret", user: "alice" }, paths);

    expect(result, "top-level redact paths should replace matching keys").toEqual({
      password: "[Redacted]",
      user: "alice",
    });
  });

  it("redacts a nested dot path", () => {
    const paths = compileRedactPaths(["req.headers.authorization"]);
    const result = applyRedaction(
      {
        req: {
          headers: {
            authorization: "Bearer token",
            accept: "json",
          },
        },
      },
      paths,
    );

    expect(result.req, "nested dot paths should redact only the targeted value").toEqual({
      headers: {
        authorization: "[Redacted]",
        accept: "json",
      },
    });
  });

  it("redacts wildcard keys at any depth", () => {
    const paths = compileRedactPaths(["*.token"]);
    const result = applyRedaction(
      {
        token: "root",
        nested: {
          token: "nested",
          list: [{ token: "item" }],
        },
      },
      paths,
    );

    expect(result, "wildcard redact paths should match token keys at any depth").toEqual({
      token: "[Redacted]",
      nested: {
        token: "[Redacted]",
        list: [{ token: "[Redacted]" }],
      },
    });
  });

  it("does not mutate the source record or shared nested objects", () => {
    const nested = { authorization: "Bearer secret" };
    const source = { user: "alice", req: { headers: nested } };
    const paths = compileRedactPaths(["req.headers.authorization"]);

    const result = applyRedaction(source, paths);

    expect(
      {
        redacted: result.req,
        sourceReq: source.req,
        nestedAuthorization: nested.authorization,
      },
      "redaction should clone values without mutating the source or shared nested objects",
    ).toEqual({
      redacted: { headers: { authorization: "[Redacted]" } },
      sourceReq: { headers: { authorization: "Bearer secret" } },
      nestedAuthorization: "Bearer secret",
    });
  });

  it("redacts records that contain non-cloneable values", () => {
    const paths = compileRedactPaths(["password"]);
    const source = { password: "secret", handler: () => undefined };
    const result = applyRedaction(source, paths);

    expect(result.password, "non-cloneable records should still redact matching keys").toBe("[Redacted]");
    expect(source.password, "the source record should remain unchanged when cloning fails").toBe("secret");
  });
});
