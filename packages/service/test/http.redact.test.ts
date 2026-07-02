import { createServer, type Server } from "node:http";

import axios, { isAxiosError, type AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceHttpClient, KnownError } from "../src/utils/http.js";

const capturedAxiosErrors: AxiosError[] = [];

const startServer = async (statusCode: number): Promise<{ server: Server; baseUrl: string }> => {
  const server = createServer((_request, response) => {
    response.writeHead(statusCode);
    response.end("fail");
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to start test HTTP server");
  }

  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

const closeServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
};

describe("createServiceHttpClient axios redact", () => {
  let server: Server | undefined;
  const axiosCreate = axios.create.bind(axios);

  beforeEach(() => {
    capturedAxiosErrors.length = 0;

    vi.spyOn(axios, "create").mockImplementation((config) => {
      const instance = axiosCreate(config);

      for (const method of ["get", "post", "put", "delete"] as const) {
        const original = instance[method].bind(instance);

        instance[method] = async (...args: Parameters<typeof original>) => {
          try {
            return await original(...args);
          } catch (error) {
            if (isAxiosError(error)) {
              capturedAxiosErrors.push(error);
            }

            throw error;
          }
        };
      }

      return instance;
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    if (server) {
      await closeServer(server);
      server = undefined;
    }
  });

  it("redacts authorization in AxiosError#toJSON() after a failed service request", async () => {
    const started = await startServer(401);

    server = started.server;

    const client = createServiceHttpClient(started.baseUrl, { apiToken: "secret-token" });

    await expect(client.get("/api/test-report"), "service client should reject failed HTTP responses").rejects.toBeInstanceOf(
      KnownError,
    );

    const axiosError = capturedAxiosErrors[0];

    expect(axiosError, "failed service requests should originate from an AxiosError").toBeDefined();

    const serializedConfig = JSON.stringify(axiosError.toJSON().config);

    expect(serializedConfig, "serialized config should not contain the raw API token").not.toContain("secret-token");
    expect(serializedConfig, "serialized config should contain axios redacted marker").toMatch(/\[REDACTED/);
  });
});
