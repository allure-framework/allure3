import { PassThrough } from "node:stream";

import type { AttachmentLinkLinked, TestResult } from "@allurereport/core-api";
import type { PluginContext } from "@allurereport/plugin-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { TestOpsPlugin } from "../../src/plugin.js";
import { handleBeforeEach, mockAllureStore, mockRequests } from "./helpers.js";

beforeEach(handleBeforeEach);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("uploads attachments from valid result steps and skips attachments under invalid steps", async () => {
  const { uploadAttachmentsForResultRequest } = mockRequests();
  const store = mockAllureStore();
  const kept: AttachmentLinkLinked = {
    id: "kept",
    name: "kept.txt",
    originalFileName: "kept.txt",
    ext: "txt",
    contentType: "text/plain",
    used: true,
    missed: false,
  };
  const removed = { ...kept, id: "removed", name: "removed.txt", originalFileName: "removed.txt" };

  const result: TestResult = {
    id: "result",
    name: "Test with attachments",
    status: "passed",
    testCaseHash: null,
    parametersHash: "",
    environmentHash: null,
    flaky: false,
    muted: false,
    known: false,
    retryHash: null,
    isRetry: false,
    labels: [],
    parameters: [],
    links: [],
    sourceMetadata: { readerId: "test", metadata: {} },
    steps: [
      {
        type: "step",
        name: "invalid\u0000step",
        status: "passed",
        parameters: [],
        steps: [{ type: "attachment", link: removed }],
      },
      { type: "attachment", link: kept },
    ],
  };
  store.allTestResults.mockResolvedValue([result]);
  store.attachmentsByTrId.mockResolvedValue([removed, kept]);
  store.attachmentContentById.mockImplementation(async (id) => new BufferResultFile(Buffer.from(id), `${id}.txt`));

  const plugin = new TestOpsPlugin({
    accessToken: "test",
    endpoint: "http://example.com",
    projectId: "12345",
    launchName: "Test Launch",
    launchTags: [],
    uploadRateLimit: false,
  });

  await plugin.start({} as PluginContext, store);

  expect(store.attachmentContentById.mock.calls).toEqual([["kept"]]);
  expect(uploadAttachmentsForResultRequest).toHaveBeenCalledTimes(1);
  const [url, form] = uploadAttachmentsForResultRequest.mock.calls[0];
  expect(url).toBe("/api/upload/test-result/1/attachment");
  const chunks: Buffer[] = [];

  for await (const chunk of form.pipe(new PassThrough())) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  expect(body).toContain('filename="kept.txt"');
  expect(body).toContain("\r\n\r\nkept\r\n");
  expect(body).not.toContain('filename="removed.txt"');
});
