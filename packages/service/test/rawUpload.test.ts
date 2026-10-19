import { mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { AllureServiceClient } from "../src/service.js";

const listen = async (server: ReturnType<typeof createServer>) => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to start upload test server");
  }

  return `http://127.0.0.1:${address.port}`;
};

it("streams a 45 MiB file as the raw request body", async () => {
  const size = 45 * 1024 * 1024;
  const directory = await mkdtemp(join(tmpdir(), "allure-service-raw-upload-"));
  const filepath = join(directory, "large.bin");
  let resolveRequest!: (request: {
    bytes: number;
    headers: Record<string, string | string[] | undefined>;
    method: string;
    url: string;
  }) => void;
  let rejectRequest!: (error: unknown) => void;
  const receivedRequest = new Promise<{
    bytes: number;
    headers: Record<string, string | string[] | undefined>;
    method: string;
    url: string;
  }>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  const server = createServer(async (request, response) => {
    try {
      let bytes = 0;

      for await (const chunk of request) {
        bytes += Buffer.byteLength(chunk);
      }

      resolveRequest({
        bytes,
        headers: request.headers,
        method: request.method ?? "",
        url: request.url ?? "",
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{}");
    } catch (error) {
      rejectRequest(error);
      response.writeHead(500);
      response.end();
    }
  });

  try {
    await writeFile(filepath, "");
    await truncate(filepath, size);

    const url = await listen(server);
    const accessToken = `ars1.${Buffer.from(JSON.stringify({ accessToken: "token", url })).toString(
      "base64url",
    )}.signature`;
    const client = new AllureServiceClient({
      accessToken,
      uploadConcurrency: 10,
      uploadMaxAttempts: 5,
      uploadMaxSimultaneousFailures: 5,
    });

    await client.addReportFile({
      reportUuid: "report-uuid",
      pluginId: "awesome",
      filename: "data/large.bin",
      filepath,
    });

    const request = await receivedRequest;

    expect(request.method).toBe("PUT");
    expect(request.url).toBe("/api/reports/report-uuid/files?path=awesome%2Fdata%2Flarge.bin");
    expect(request.headers["content-type"]).toBe("application/octet-stream");
    expect(request.headers["content-length"]).toBe(String(size));
    expect(request.bytes).toBe(size);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { force: true, recursive: true });
  }
}, 20_000);
