import { layer } from "allure-js-commons";
import axios from "axios";
import getPort from "get-port";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, expect, it } from "vitest";
import { type AllureStaticServer, serve } from "../../src/index.js";

const baseDir = dirname(fileURLToPath(import.meta.url));
const servePath = join(baseDir, "fixtures");

let port: number;
let server: AllureStaticServer;

beforeEach(async () => {
  await layer("unit");

  port = await getPort();
  server?.stop();
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
