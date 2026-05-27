import { attachment, label } from "allure-js-commons";
import { describe, expect, it } from "vitest";

const HTTP_EXCHANGE_ATTACHMENT_MIME = "application/vnd.allure.http+json";
const REDACTED = "__ALLURE_REDACTED__";
const SAMPLE_PNG_BASE64 = [
  "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",
].join("");
const SAMPLE_VIDEO_BASE64 = "AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAA==";

type HttpPair = {
  name: string;
  value: string;
};

type HttpCookie = HttpPair & {
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: string;
  secure?: boolean;
};

type HttpBodyPart = {
  name?: string;
  fileName?: string;
  headers?: HttpPair[];
  contentType?: string;
  encoding?: string;
  value?: string;
  size?: number;
  truncated?: boolean;
};

type HttpBody = {
  contentType?: string;
  encoding?: string;
  value?: string;
  size?: number;
  truncated?: boolean;
  form?: HttpPair[];
  parts?: HttpBodyPart[];
  stream?: {
    type?: string;
    complete?: boolean;
    chunkCount?: number;
  };
};

type HttpRequest = {
  method: string;
  url: string;
  httpVersion?: string;
  headers?: HttpPair[];
  cookies?: HttpCookie[];
  query?: HttpPair[];
  body?: HttpBody;
  trailers?: HttpPair[];
};

type HttpResponse = {
  status?: number;
  statusText?: string;
  httpVersion?: string;
  headers?: HttpPair[];
  cookies?: HttpCookie[];
  body?: HttpBody;
  trailers?: HttpPair[];
  informationalResponses?: Array<{
    status: number;
    statusText?: string;
    headers?: HttpPair[];
  }>;
};

type HttpExchangePayload = {
  schemaVersion: 1;
  start?: number;
  stop?: number;
  request: HttpRequest;
  response?: HttpResponse;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
};

type HttpExchangeVariant = {
  name: string;
  payload: HttpExchangePayload;
};

const jsonBody = (value: unknown): HttpBody => {
  const text = JSON.stringify(value);

  return {
    contentType: "application/json",
    encoding: "utf8",
    value: text,
    size: text.length,
    truncated: false,
  };
};

const HTTP_EXCHANGE_VARIANTS: HttpExchangeVariant[] = [
  {
    name: "HTTP Exchange",
    payload: {
      schemaVersion: 1,
      start: 1710000186400,
      stop: 1710000186487,
      request: {
        method: "POST",
        url: "https://api.example.com/v1/orders/42?dryRun=true",
        httpVersion: "HTTP/1.1",
        query: [{ name: "dryRun", value: "true" }],
        cookies: [
          { name: "sid", value: REDACTED, path: "/", httpOnly: true, secure: true },
          { name: "theme", value: "dark", sameSite: "Lax" },
        ],
        headers: [
          { name: "authorization", value: REDACTED },
          { name: "content-type", value: "application/json" },
          { name: "cookie", value: REDACTED },
        ],
        body: jsonBody({ name: "demo", quantity: 1 }),
      },
      response: {
        status: 201,
        statusText: "Created",
        httpVersion: "HTTP/1.1",
        cookies: [{ name: "sid", value: REDACTED, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }],
        headers: [
          { name: "content-type", value: "application/json" },
          { name: "set-cookie", value: REDACTED },
        ],
        body: jsonBody({
          id: 42,
          echo: "<script>window.__httpAttachmentXss = true</script>",
        }),
      },
    },
  },
  {
    name: "HTTP Exchange image",
    payload: {
      schemaVersion: 1,
      start: 1710000186680,
      stop: 1710000186696,
      request: {
        method: "GET",
        url: "https://api.example.com/v1/orders/42/receipt-image",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "accept", value: "image/png" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "content-type", value: "image/png" }],
        body: {
          contentType: "image/png",
          encoding: "base64",
          value: SAMPLE_PNG_BASE64,
          size: 1616,
          truncated: false,
        },
      },
    },
  },
  {
    name: "HTTP Exchange form",
    payload: {
      schemaVersion: 1,
      start: 1710000186700,
      stop: 1710000186714,
      request: {
        method: "POST",
        url: "https://api.example.com/login",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "content-type", value: "application/x-www-form-urlencoded" }],
        body: {
          contentType: "application/x-www-form-urlencoded",
          encoding: "utf8",
          value: `username=demo&password=${REDACTED}&remember=true`,
          size: 59,
          truncated: false,
          form: [
            { name: "username", value: "demo" },
            { name: "password", value: REDACTED },
            { name: "remember", value: "true" },
          ],
        },
      },
      response: {
        status: 204,
        statusText: "No Content",
        httpVersion: "HTTP/1.1",
        headers: [],
      },
    },
  },
  {
    name: "HTTP Exchange multipart",
    payload: {
      schemaVersion: 1,
      start: 1710000186720,
      stop: 1710000186738,
      request: {
        method: "POST",
        url: "https://api.example.com/profile",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "content-type", value: "multipart/form-data; boundary=----allure-boundary" }],
        body: {
          contentType: "multipart/form-data; boundary=----allure-boundary",
          size: 24588,
          truncated: false,
          parts: [
            {
              name: "metadata",
              headers: [{ name: "content-type", value: "application/json" }],
              contentType: "application/json",
              encoding: "utf8",
              value: '{"displayName":"Demo User"}',
              size: 27,
              truncated: false,
            },
            {
              name: "avatar",
              fileName: "avatar.png",
              headers: [{ name: "content-type", value: "image/png" }],
              contentType: "image/png",
              encoding: "base64",
              value: SAMPLE_PNG_BASE64,
              size: 24512,
              truncated: true,
            },
          ],
        },
      },
      response: {
        status: 200,
        statusText: "OK",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "content-type", value: "application/json" }],
        body: jsonBody({ uploaded: true }),
      },
    },
  },
  {
    name: "HTTP Exchange stream",
    payload: {
      schemaVersion: 1,
      start: 1710000186740,
      stop: 1710000186759,
      request: {
        method: "GET",
        url: "https://api.example.com/events",
        httpVersion: "HTTP/2",
        headers: [{ name: "accept", value: "text/event-stream" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        httpVersion: "HTTP/2",
        headers: [{ name: "content-type", value: "text/event-stream" }],
        body: {
          contentType: "text/event-stream",
          encoding: "utf8",
          value: 'event: ready\ndata: {"ok":true}\n\n',
          size: 34,
          truncated: true,
          stream: {
            type: "server-sent-events",
            complete: false,
            chunkCount: 1,
          },
        },
      },
    },
  },
  {
    name: "HTTP Exchange request only",
    payload: {
      schemaVersion: 1,
      start: 1710000186760,
      stop: 1710000186772,
      request: {
        method: "DELETE",
        url: "https://api.example.com/v1/orders/42?force=true",
        httpVersion: "HTTP/1.1",
        headers: [
          { name: "authorization", value: REDACTED },
          { name: "x-request-id", value: "demo-request-only" },
        ],
        query: [{ name: "force", value: "true" }],
      },
    },
  },
  {
    name: "HTTP Exchange HTML",
    payload: {
      schemaVersion: 1,
      start: 1710000186780,
      stop: 1710000186799,
      request: {
        method: "GET",
        url: "https://api.example.com/admin/preview",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "accept", value: "text/html" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "content-type", value: "text/html" }],
        body: {
          contentType: "text/html",
          encoding: "utf8",
          value:
            "<!doctype html><html><body><h1>Admin preview</h1><script>window.__httpExchangeHtmlExecuted = true</script></body></html>",
          size: 123,
          truncated: false,
        },
      },
    },
  },
  {
    name: "HTTP Exchange video",
    payload: {
      schemaVersion: 1,
      start: 1710000186800,
      stop: 1710000186831,
      request: {
        method: "GET",
        url: "https://api.example.com/v1/orders/42/replay.mp4",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "accept", value: "video/mp4" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "content-type", value: "video/mp4" }],
        body: {
          contentType: "video/mp4",
          encoding: "base64",
          value: SAMPLE_VIDEO_BASE64,
          size: 38,
          truncated: false,
        },
      },
    },
  },
  {
    name: "HTTP Exchange error",
    payload: {
      schemaVersion: 1,
      start: 1710000186820,
      stop: 1710000191820,
      request: {
        method: "GET",
        url: "https://api.example.com/v1/orders/42/slow",
        httpVersion: "HTTP/2",
        headers: [{ name: "accept", value: "application/json" }],
      },
      error: {
        name: "TimeoutError",
        message: "Request timed out after 5000 ms",
        stack: "TimeoutError: Request timed out after 5000 ms\n    at DemoHttpClient.send (demo-client.ts:42:13)",
      },
    },
  },
  {
    name: "HTTP Exchange gRPC trailers",
    payload: {
      schemaVersion: 1,
      start: 1710000186840,
      stop: 1710000186874,
      request: {
        method: "POST",
        url: "https://api.example.com/checkout.CheckoutService/CreateOrder",
        httpVersion: "HTTP/2",
        headers: [
          { name: "content-type", value: "application/grpc" },
          { name: "te", value: "trailers" },
        ],
        body: {
          contentType: "application/grpc",
          encoding: "base64",
          value: "AAAAABMKBGRlbW8QKg==",
          size: 18,
          truncated: false,
        },
      },
      response: {
        status: 200,
        httpVersion: "HTTP/2",
        headers: [{ name: "content-type", value: "application/grpc" }],
        body: {
          contentType: "application/grpc",
          encoding: "base64",
          value: "AAAAAAUIKg==",
          size: 10,
          truncated: false,
        },
        trailers: [
          { name: "grpc-status", value: "0" },
          { name: "grpc-message", value: "" },
        ],
      },
    },
  },
  {
    name: "HTTP Exchange informational response",
    payload: {
      schemaVersion: 1,
      start: 1710000186860,
      stop: 1710000186912,
      request: {
        method: "POST",
        url: "https://api.example.com/upload",
        httpVersion: "HTTP/1.1",
        headers: [
          { name: "expect", value: "100-continue" },
          { name: "content-type", value: "application/octet-stream" },
        ],
        body: {
          contentType: "application/octet-stream",
          encoding: "base64",
          value: "AAECAwQFBgc=",
          size: 8,
          truncated: false,
        },
      },
      response: {
        status: 201,
        statusText: "Created",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "location", value: "/upload/abc123" }],
        informationalResponses: [
          { status: 100, statusText: "Continue", headers: [] },
          {
            status: 103,
            statusText: "Early Hints",
            headers: [{ name: "link", value: "</upload.css>; rel=preload; as=style" }],
          },
        ],
        body: jsonBody({ id: "abc123", stored: true }),
      },
    },
  },
  {
    name: "HTTP Exchange redirect",
    payload: {
      schemaVersion: 1,
      start: 1710000186880,
      stop: 1710000186891,
      request: {
        method: "GET",
        url: "http://api.example.com/v1/orders/42",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "accept", value: "application/json" }],
      },
      response: {
        status: 301,
        statusText: "Moved Permanently",
        httpVersion: "HTTP/1.1",
        headers: [
          { name: "location", value: "https://api.example.com/v1/orders/42" },
          { name: "cache-control", value: "max-age=3600" },
        ],
      },
    },
  },
  {
    name: "HTTP Exchange compression",
    payload: {
      schemaVersion: 1,
      start: 1710000186900,
      stop: 1710000186926,
      request: {
        method: "GET",
        url: "https://api.example.com/v1/orders/42/report",
        httpVersion: "HTTP/2",
        headers: [
          { name: "accept", value: "application/json" },
          { name: "accept-encoding", value: "gzip, br" },
        ],
      },
      response: {
        status: 200,
        statusText: "OK",
        httpVersion: "HTTP/2",
        headers: [
          { name: "content-type", value: "application/json" },
          { name: "content-encoding", value: "gzip" },
        ],
        body: jsonBody({ compressed: true, decodedByClient: true }),
      },
    },
  },
  {
    name: "HTTP Exchange binary",
    payload: {
      schemaVersion: 1,
      start: 1710000186920,
      stop: 1710000186948,
      request: {
        method: "GET",
        url: "https://api.example.com/v1/orders/42/export.bin",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "accept", value: "application/octet-stream" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        httpVersion: "HTTP/1.1",
        headers: [{ name: "content-type", value: "application/octet-stream" }],
        body: {
          contentType: "application/octet-stream",
          encoding: "base64",
          value: "AAECAwQFBgcICQoLDA0ODw==",
          size: 16,
          truncated: false,
        },
      },
    },
  },
  {
    name: "HTTP Exchange upgrade",
    payload: {
      schemaVersion: 1,
      start: 1710000186940,
      stop: 1710000186955,
      request: {
        method: "GET",
        url: "https://api.example.com/socket",
        httpVersion: "HTTP/1.1",
        headers: [
          { name: "connection", value: "Upgrade" },
          { name: "upgrade", value: "websocket" },
          { name: "sec-websocket-key", value: REDACTED },
        ],
      },
      response: {
        status: 101,
        statusText: "Switching Protocols",
        httpVersion: "HTTP/1.1",
        headers: [
          { name: "connection", value: "Upgrade" },
          { name: "upgrade", value: "websocket" },
          { name: "sec-websocket-accept", value: REDACTED },
        ],
      },
    },
  },
];

describe("HTTP Exchange attachments sandbox", () => {
  it("renders every HTTP Exchange attachment variant", async () => {
    await label("feature", "Attachments");
    await label("story", "HTTP Exchange");
    await label("component", "http-attachment");

    for (const variant of HTTP_EXCHANGE_VARIANTS) {
      await attachment(variant.name, JSON.stringify(variant.payload, null, 2), HTTP_EXCHANGE_ATTACHMENT_MIME);
    }

    expect(HTTP_EXCHANGE_VARIANTS.map(({ name }) => name)).toEqual([
      "HTTP Exchange",
      "HTTP Exchange image",
      "HTTP Exchange form",
      "HTTP Exchange multipart",
      "HTTP Exchange stream",
      "HTTP Exchange request only",
      "HTTP Exchange HTML",
      "HTTP Exchange video",
      "HTTP Exchange error",
      "HTTP Exchange gRPC trailers",
      "HTTP Exchange informational response",
      "HTTP Exchange redirect",
      "HTTP Exchange compression",
      "HTTP Exchange binary",
      "HTTP Exchange upgrade",
    ]);
  });
});
