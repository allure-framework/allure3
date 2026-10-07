import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { layer, story } from "allure-js-commons";
import axios from "axios";
import getPort from "get-port";
import { beforeEach, expect, it } from "vitest";

import { type AllureStaticServer, serve } from "../../src/index.js";

beforeEach(async () => {
  await story("static");
});

const baseDir = dirname(fileURLToPath(import.meta.url));
const servePath = join(baseDir, "fixtures");

let port: number;
let server: AllureStaticServer;

beforeEach(async () => {
  await layer("unit");

  port = await getPort();
  server?.stop();
});

it("binds to the provided host and reports it in the url", async () => {
  server = await serve({ port, host: "127.0.0.1", servePath });

  expect(server.url).toBe(`http://127.0.0.1:${port}`);

  const res = await axios.get(`http://127.0.0.1:${port}/sample`, {
    timeout: 500,
  });

  expect(res.status).toBe(200);
});

it("uses localhost in the url when no host is provided", async () => {
  server = await serve({ port, servePath });

  expect(server.url).toBe(`http://localhost:${port}`);
});

it("rejects when the server cannot bind to the provided host", async () => {
  await expect(serve({ port, host: "192.0.2.1", servePath })).rejects.toThrow();
});

it("serves files without extension as binary ones", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/sample`, {
    timeout: 500,
  });

  expect(res.headers["content-type"]).toBe("application/octet-stream");
  expect(res.data).not.toBeUndefined();
});

it("decode path before accessing the file system", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/with%20space`, {
    timeout: 500,
  });

  expect(res.headers["content-type"]).toBe("application/octet-stream");
  expect(res.status).toBe(200);
});

it("serves .bin files", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/sample.bin`, {
    timeout: 500,
  });

  expect(res.headers["content-type"]).toBe("application/octet-stream");
  expect(res.data).not.toBeUndefined();
});

it("serves files with query parameters", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/sample?attachment`, {
    timeout: 500,
  });

  expect(res.headers["content-type"]).toBe("application/octet-stream");
  expect(res.data).not.toBeUndefined();
});

it("returns 404 for path traversal outside the serve root", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/../../static.test.ts`, {
    timeout: 500,
    validateStatus: () => true,
  });

  expect(res.status).toBe(404);
});
