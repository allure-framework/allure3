import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { influxDbWriteUrl, pushToInfluxDb, pushToPushgateway, pushgatewayUrl } from "../src/push.js";
import { redactUrl } from "../src/utils.js";

beforeEach(async () => {
  await story("push");
});

const okResponse = () => new Response(null, { status: 200 });

describe("pushgateway", () => {
  it("builds the grouping path", () => {
    expect(pushgatewayUrl({ url: "http://pg:9091/", job: "my job", grouping: { instance: "ci-1" } })).toBe(
      "http://pg:9091/metrics/job/my%20job/instance/ci-1",
    );
    expect(pushgatewayUrl({ url: "http://pg:9091" })).toBe("http://pg:9091/metrics/job/allure");
  });

  it("base64-encodes grouping values with slashes and uses `=` for empty ones", () => {
    // examples from the Pushgateway documentation
    expect(pushgatewayUrl({ url: "http://pg:9091", job: "directory_cleaner", grouping: { path: "/var/tmp" } })).toBe(
      "http://pg:9091/metrics/job/directory_cleaner/path@base64/L3Zhci90bXA",
    );
    expect(
      pushgatewayUrl({ url: "http://pg:9091", job: "example", grouping: { first_label: "", second_label: "foobar" } }),
    ).toBe("http://pg:9091/metrics/job/example/first_label@base64/=/second_label/foobar");
    expect(pushgatewayUrl({ url: "http://pg:9091", job: "a/b" })).toBe("http://pg:9091/metrics/job@base64/YS9i");
  });

  it("PUTs the body with the authorization taken from the environment", async () => {
    const doFetch = vi.fn().mockResolvedValue(okResponse());

    await pushToPushgateway(
      { url: "http://pg:9091", authorizationEnv: "PG_AUTH" },
      "body\n",
      { PG_AUTH: "Basic abc" },
      doFetch,
    );

    expect(doFetch).toHaveBeenCalledWith("http://pg:9091/metrics/job/allure", {
      method: "PUT",
      headers: { "Content-Type": "text/plain; version=0.0.4", "Authorization": "Basic abc" },
      body: "body\n",
      signal: expect.any(AbortSignal),
    });
  });

  it("throws with the response details on a non-2xx answer", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response("nope", { status: 500, statusText: "Server Error" }));

    await expect(pushToPushgateway({ url: "http://pg:9091" }, "x", {}, doFetch)).rejects.toThrow(
      /500 Server Error nope/,
    );
  });
});

describe("redactUrl", () => {
  it("removes credentials from a url", () => {
    expect(redactUrl("http://user:secret@pg:9091/metrics/job/allure")).toBe("http://pg:9091/metrics/job/allure");
    expect(redactUrl("not a url")).toBe("not a url");
  });

  it("does not leak credentials into push errors", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response("nope", { status: 401, statusText: "Unauthorized" }));

    await expect(pushToPushgateway({ url: "http://user:secret@pg:9091" }, "x", {}, doFetch)).rejects.not.toThrow(
      /secret/,
    );
  });
});

describe("influxdb", () => {
  it("builds 2.x and 1.x write urls", () => {
    expect(influxDbWriteUrl({ url: "http://influx:8086/", org: "qa", bucket: "allure" })).toBe(
      "http://influx:8086/api/v2/write?bucket=allure&org=qa&precision=ns",
    );
    expect(influxDbWriteUrl({ url: "http://influx:8086", db: "allure" })).toBe(
      "http://influx:8086/write?db=allure&precision=ns",
    );
  });

  it("requires a bucket or a database", () => {
    expect(() => influxDbWriteUrl({ url: "http://influx:8086" })).toThrow(/bucket/);
  });

  it("requires an organization for a bucket", () => {
    expect(() => influxDbWriteUrl({ url: "http://influx:8086", bucket: "allure" })).toThrow(/`org`/);
  });

  it("uses Basic authentication for InfluxDB 1.x credentials", async () => {
    const doFetch = vi.fn().mockResolvedValue(okResponse());

    await pushToInfluxDb(
      { url: "http://influx:8086", db: "allure", username: "writer", passwordEnv: "INFLUX_PASSWORD" },
      "line\n",
      { INFLUX_PASSWORD: "s3cret" },
      doFetch,
    );

    expect(doFetch.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from("writer:s3cret").toString("base64")}`,
    );
  });

  it("prefers the token over 1.x credentials", async () => {
    const doFetch = vi.fn().mockResolvedValue(okResponse());

    await pushToInfluxDb(
      { url: "http://influx:8086", bucket: "b", org: "o", token: "t0k", username: "writer", password: "x" },
      "line\n",
      {},
      doFetch,
    );

    expect(doFetch.mock.calls[0][1].headers.Authorization).toBe("Token t0k");
  });

  it("POSTs the body with the token taken from the environment", async () => {
    const doFetch = vi.fn().mockResolvedValue(okResponse());

    await pushToInfluxDb(
      { url: "http://influx:8086", bucket: "b", org: "o", tokenEnv: "INFLUX_TOKEN" },
      "line\n",
      { INFLUX_TOKEN: "t0k" },
      doFetch,
    );

    expect(doFetch).toHaveBeenCalledWith("http://influx:8086/api/v2/write?bucket=b&org=o&precision=ns", {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8", "Authorization": "Token t0k" },
      body: "line\n",
      signal: expect.any(AbortSignal),
    });
  });
});
