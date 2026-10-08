import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { KnownError } from "../src/utils/http.js";
import { encodeUploadPath, normalizeUploadPath, uploadStorageReport } from "../src/utils/storage.js";

const uploadConfig = {
  uploadConcurrency: 10,
  uploadMaxAttempts: 5,
  uploadMaxSimultaneousFailures: 5,
};

const uploadError = (
  status: number,
  options: {
    mitigated?: string;
    rayId?: string;
    retryAfter?: string;
    responseMessage?: string;
  } = {},
) =>
  new KnownError(`request failed with ${status}`, status, {
    details: {
      method: "put",
      endpoint: "/api/reports/report-uuid/files?path=data%2Fresult.json",
      status,
      ...options,
    },
  });

const tempDirectories: string[] = [];

const createTempFile = async (content: string) => {
  const directory = await mkdtemp(join(tmpdir(), "allure-service-upload-"));
  const filepath = join(directory, "file");

  tempDirectories.push(directory);
  await writeFile(filepath, content);

  return filepath;
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("storage upload paths", () => {
  it("normalizes platform separators and encodes one canonical query value", () => {
    const path = normalizeUploadPath("awesome\\data\\test-results\\result.json");

    expect(path).toBe("awesome/data/test-results/result.json");
    expect(encodeUploadPath(path)).toBe("awesome%2Fdata%2Ftest-results%2Fresult.json");
  });

  it.each([
    "",
    "/absolute",
    "C:\\absolute",
    "C:relative",
    "data/../secret",
    "data/./result",
    "data//result",
    "data/\0result",
  ])("rejects invalid path %j", (path) => {
    expect(() => normalizeUploadPath(path)).toThrow("Invalid upload path");
  });
});

describe("uploadStorageReport", () => {
  it("uses a bounded worker pool for report files", async () => {
    const filepath = await createTempFile("content");
    let active = 0;
    let maximumActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const upload = vi.fn(async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await gate;
      active--;

      return "https://example.org/file";
    });
    const files = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [`data/file-${index}.json`, filepath]));
    const resultPromise = uploadStorageReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files,
      uploadedAssets: new Set(),
      upload,
    });

    await vi.waitFor(() => expect(maximumActive).toBe(10));
    release();
    await resultPromise;

    expect(upload).toHaveBeenCalledTimes(500);
    expect(maximumActive).toBe(10);
  });

  it("retries transient failures with delay and advances progress once", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const filepath = await createTempFile("content");
    const progress = vi.fn();
    const attempts: number[] = [];
    const upload = vi.fn(async () => {
      attempts.push(Date.now());

      if (attempts.length <= 2) {
        throw uploadError(503);
      }

      return "https://example.org/result.json";
    });
    const result = await uploadStorageReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: { "data/result.json": filepath },
      uploadedAssets: new Set(),
      upload,
      onProgress: progress,
    });

    expect(upload).toHaveBeenCalledTimes(3);
    expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(450);
    expect(attempts[2] - attempts[1]).toBeGreaterThanOrEqual(950);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(result.hrefs["data/result.json"]).toBe("https://example.org/result.json");
  });

  it("honors Retry-After", async () => {
    const filepath = await createTempFile("content");
    const attempts: number[] = [];
    const upload = vi.fn(async () => {
      attempts.push(Date.now());

      if (attempts.length === 1) {
        throw uploadError(429, { retryAfter: "0.05" });
      }

      return "https://example.org/result.json";
    });

    await uploadStorageReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: { "data/result.json": filepath },
      uploadedAssets: new Set(),
      upload,
    });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(45);
  });

  it.each([400, 401, 403, 404, 409])("does not retry HTTP %s", async (status) => {
    const filepath = await createTempFile("content");
    const upload = vi.fn().mockRejectedValue(uploadError(status));

    await expect(
      uploadStorageReport({
        ...uploadConfig,
        reportUuid: "report-uuid",
        files: { "data/result.json": filepath },
        uploadedAssets: new Set(),
        upload,
      }),
    ).rejects.toMatchObject({ status });

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("formats Cloudflare challenge errors without HTML", async () => {
    const filepath = await createTempFile("content");
    const upload = vi.fn().mockRejectedValue(
      uploadError(403, {
        mitigated: "challenge",
        rayId: "a3b65dc5f8e42b9c",
        responseMessage: "<html>challenge</html>",
      }),
    );

    await expect(
      uploadStorageReport({
        ...uploadConfig,
        reportUuid: "report-uuid",
        files: { "data/result.json": filepath },
        uploadedAssets: new Set(),
        upload,
      }),
    ).rejects.toMatchObject({
      message: expect.not.stringContaining("<html>"),
      status: 403,
    });
  });

  it("uploads repeated shared asset paths once and reports progress once", async () => {
    const first = await createTempFile("first");
    const second = await createTempFile("second");
    const progress = vi.fn();
    const upload = vi.fn().mockResolvedValue(undefined);

    await uploadStorageReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: [{ "app.js": first }, { "app.js": second }],
      uploadedAssets: new Set(),
      upload,
      onProgress: progress,
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it("deduplicates assets across upload calls for one publication", async () => {
    const first = await createTempFile("first");
    const second = await createTempFile("second");
    const uploadedAssets = new Set<string>();
    const upload = vi.fn().mockResolvedValue(undefined);

    await uploadStorageReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: { "app.js": first },
      uploadedAssets,
      upload,
    });
    await uploadStorageReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: { "app.js": second },
      uploadedAssets,
      upload,
    });

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("aborts active uploads and waits for them to settle", async () => {
    const filepath = await createTempFile("content");
    const controller = new AbortController();
    let active = 0;
    let settled = 0;
    const progress = vi.fn();
    const upload = vi.fn(
      async (_file, signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          active++;
          signal.addEventListener(
            "abort",
            () => {
              active--;
              settled++;
              reject(signal.reason);
            },
            { once: true },
          );
        }),
    );
    const resultPromise = uploadStorageReport({
      ...uploadConfig,
      uploadConcurrency: 2,
      reportUuid: "report-uuid",
      files: {
        "data/one.json": filepath,
        "data/two.json": filepath,
        "data/three.json": filepath,
      },
      uploadedAssets: new Set(),
      upload,
      signal: controller.signal,
      onProgress: progress,
    });

    await vi.waitFor(() => expect(active).toBe(2));
    controller.abort(new Error("cancelled"));

    await expect(resultPromise).rejects.toThrow("cancelled");
    expect(upload).toHaveBeenCalledTimes(2);
    expect(active).toBe(0);
    expect(settled).toBe(2);
    expect(progress).not.toHaveBeenCalled();
  });
});
