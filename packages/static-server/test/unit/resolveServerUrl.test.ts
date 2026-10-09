import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { normalizeHost, resolveServerUrl } from "../../src/utils.js";

beforeEach(async () => {
  await story("resolveServerUrl");
});

describe("resolveServerUrl", () => {
  it("falls back to localhost when no host is provided", () => {
    expect(resolveServerUrl(undefined, 3000)).toBe("http://localhost:3000");
  });

  it("falls back to localhost for wildcard hosts", () => {
    expect(resolveServerUrl("0.0.0.0", 3000)).toBe("http://localhost:3000");
    expect(resolveServerUrl("::", 3000)).toBe("http://localhost:3000");
  });

  it("uses the provided host", () => {
    expect(resolveServerUrl("127.0.0.1", 3000)).toBe("http://127.0.0.1:3000");
    expect(resolveServerUrl("my.host", 3000)).toBe("http://my.host:3000");
  });

  it("wraps IPv6 hosts in brackets once", () => {
    expect(resolveServerUrl("::1", 3000)).toBe("http://[::1]:3000");
    expect(resolveServerUrl("[::1]", 3000)).toBe("http://[::1]:3000");
  });

  it("treats a blank host as not set", () => {
    expect(resolveServerUrl("  ", 3000)).toBe("http://localhost:3000");
  });
});

describe("normalizeHost", () => {
  it("drops blank hosts and IPv6 brackets", () => {
    expect(normalizeHost(undefined)).toBeUndefined();
    expect(normalizeHost("")).toBeUndefined();
    expect(normalizeHost(" 127.0.0.1 ")).toBe("127.0.0.1");
    expect(normalizeHost("[::1]")).toBe("::1");
  });
});
