import { layer } from "allure-js-commons";
import axios from "axios";
import getPort from "get-port";
import { join } from "node:path";
import { beforeEach, expect, it } from "vitest";
import { type AllureStaticServer, serve } from "../../src/index.js";

const baseDir = new URL(".", import.meta.url).pathname;
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
    timeout: 100,
  });

  expect(res.headers["content-type"]).toBe("application/octet-stream");
  expect(res.data).not.toBeUndefined();
});

it("serves .bin files", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/sample.bin`, {
    timeout: 100,
  });

  expect(res.headers["content-type"]).toBe("application/octet-stream");
  expect(res.data).not.toBeUndefined();
});

it("serves files with query parameters", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/sample?attachment`, {
    timeout: 100,
  });

  expect(res.headers["content-type"]).toBe("application/octet-stream");
  expect(res.data).not.toBeUndefined();
});
