import { layer } from "allure-js-commons";
import axios, { type AxiosError } from "axios";
import getPort from "get-port";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { type AllureStaticServer, serve } from "../../src/index.js";

const baseDir = dirname(fileURLToPath(import.meta.url));
const servePath = join(baseDir, "fixtures");

let server: AllureStaticServer;
let port: number;

beforeEach(async () => {
  await layer("unit");

  port = await getPort();
  server?.stop();
});

it("returns code 404 when the requested file doesn't exist", async () => {
  server = await serve({ port, servePath });

  try {
    await axios.get(`http://localhost:${port}/404.html`, {
      timeout: 500,
    });
  } catch (err) {
    expect((err as AxiosError).response).toMatchObject({
      status: 404,
    });
  }
});

it("returns index.html file by the full path", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/index.html`, {
    timeout: 500,
    headers: {
      "Content-Type": "text/html",
    },
  });

  expect(res.status).toBe(200);
  expect(res.data).toMatchSnapshot();
});

it("returns index.html when an url ends with /, when the file exists", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/`, {
    timeout: 500,
    headers: {
      "Content-Type": "text/html",
    },
  });

  expect(res.status).toBe(200);
  expect(res.data).toMatchSnapshot();
});

it("returns page with available files when an url ends with / and index.html doesn't exist", async () => {
  server = await serve({ port, servePath: join(servePath, "withoutIndex") });
  const res = await axios.get(`http://localhost:${port}/`, {
    timeout: 500,
    headers: {
      "Content-Type": "text/html",
    },
  });

  expect(res.status).toBe(200);
  expect(res.data).toMatchSnapshot();
});

it("returns page with available files when an url ends with / asd", async () => {
  server = await serve({ port, servePath: join(servePath, "withoutIndex", "baz") });
  const res = await axios.get(`http://localhost:${port}/`, {
    timeout: 500,
    headers: {
      "Content-Type": "text/html",
    },
  });

  expect(res.status).toBe(200);
  expect(res.data).toMatchSnapshot();
});

it("returns index.html when an url ends just with word without file extension", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}`, {
    timeout: 500,
    headers: {
      "Content-Type": "text/html",
    },
  });

  expect(res.status).toBe(200);
  expect(res.data).toMatchSnapshot();
});

it("returns nested/index.html file by the full path", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/nested/index.html`, {
    timeout: 500,
    headers: {
      "Content-Type": "text/html",
    },
  });

  expect(res.status).toBe(200);
  expect(res.data).toMatchSnapshot();
});

it("returns nested/index.html when an url ends with /", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/nested/`, {
    timeout: 500,
    headers: {
      "Content-Type": "text/html",
    },
  });

  expect(res.status).toBe(200);
  expect(res.data).toMatchSnapshot();
});

it("returns nested/index.html when an url ends just with word without file extension", async () => {
  server = await serve({ port, servePath });
  const res = await axios.get(`http://localhost:${port}/nested`, {
    timeout: 500,
    headers: {
      "Content-Type": "text/html",
    },
  });

  expect(res.status).toBe(200);
  expect(res.data).toMatchSnapshot();
});

describe("live", () => {
  it("injects live reload script", async () => {
    server = await serve({ port, servePath, live: true });
    const res = await axios.get(`http://localhost:${port}/index.html`, {
      timeout: 500,
      headers: {
        "Content-Type": "text/html",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data).toMatchSnapshot();
  });

  it("doesn't inject live reload script to html with attachment query parameter", async () => {
    server = await serve({ port, servePath, live: true });
    const res = await axios.get(`http://localhost:${port}/index.html?attachment`, {
      timeout: 500,
      headers: {
        "Content-Type": "text/html",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data).toMatchSnapshot();
  });
});
