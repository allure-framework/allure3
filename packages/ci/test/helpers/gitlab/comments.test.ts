import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { upsertGitlabJobNote } from "../../../src/helpers/gitlab/comments.js";
import type { GitlabReportSummary } from "../../../src/helpers/gitlab/types.js";
import { gitlabEnv, jsonResponse, mockEnv, stubRequest } from "./test-utils.js";

vi.mock("../../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const apiToken = "supplied-token";
const summary: GitlabReportSummary = {
  name: "Tests | <smoke>",
  duration: 1000,
  stats: { total: 9, passed: 4, failed: 1, broken: 2, skipped: 1, unknown: 1 },
  newTests: 2,
  flakyTests: 1,
  retryTests: 3,
};

const mergeRequestEnv = (overrides: Record<string, string> = {}) =>
  gitlabEnv({ CI_MERGE_REQUEST_IID: "7", CI_MERGE_REQUEST_PROJECT_ID: "1", ...overrides });

const marker = (pipelineId: string, jobId: string, encodedJobName = "dGVzdHM=") =>
  `<!-- allure-gitlab-summary:v1:${encodedJobName}:${pipelineId}:${jobId} -->`;

const noteBody = (pipelineId: string, jobId: string, text = "old", encodedJobName = "dGVzdHM=") =>
  `${marker(pipelineId, jobId, encodedJobName)}\n${text}`;

const notesPath = (page: number) =>
  `https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes?per_page=100&page=${page}`;

const notesResponse = (notes: unknown, nextPage = "") =>
  jsonResponse(notes, { headers: { "content-type": "application/json", "x-next-page": nextPage } });

const requestBody = (body: unknown) => (body as { body: string }).body;

beforeEach(async () => {
  await story("gitlab comments");
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("upsertGitlabJobNote", () => {
  it("creates an owned MR note containing only the report URL when no matching note exists", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) => {
      if (call.method === "GET" && call.url === notesPath(1)) {
        return notesResponse([]);
      }

      if (
        call.method === "POST" &&
        call.url === "https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes"
      ) {
        return jsonResponse({ id: 10, body: requestBody(call.body) });
      }

      throw new Error("unexpected request");
    });

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${notesPath(1)}`,
      "POST https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes",
    ]);
    const body = requestBody(calls[1].body);
    expect(body).toBe("<!-- allure-gitlab-summary:v1:dGVzdHM=:100:1000 -->\nhttps://reports.example/run/index.html");
  });

  it("posts with the supplied token", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) => (call.method === "GET" ? notesResponse([]) : jsonResponse({ id: 10 })));

    await upsertGitlabJobNote({
      token: "explicit-token",
      summary,
      reportUrl: "https://reports.example/run/index.html",
    });
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
    expect(calls.map((call) => call.headers["private-token"])).toEqual(["explicit-token", "explicit-token"]);
  });

  it("updates the newest owned note for an older logical run and keeps unrelated notes untouched", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) => {
      if (call.method === "GET") {
        return notesResponse([
          { id: 1, body: "<!-- allure -->\nlegacy publisher note" },
          { id: 2, body: noteBody("98", "980", "older") },
          { id: 3, body: noteBody("99", "990", "newest older") },
          { id: 4, body: noteBody("99", "991", "different job", "bGludA==") },
        ]);
      }

      if (
        call.method === "PUT" &&
        call.url === "https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes/3"
      ) {
        return jsonResponse({ id: 3, body: requestBody(call.body) });
      }

      throw new Error("unexpected request");
    });

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${notesPath(1)}`,
      "PUT https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes/3",
    ]);
    expect(requestBody(calls[1].body)).toBe(
      "<!-- allure-gitlab-summary:v1:dGVzdHM=:100:1000 -->\nhttps://reports.example/run/index.html",
    );
  });

  it("keeps the exact-job ownership identity stable across runs within the MR", async () => {
    mockEnv(mergeRequestEnv());
    const first = stubRequest((call) => {
      if (call.method === "GET") {
        return notesResponse([]);
      }

      return jsonResponse({ id: 10, body: requestBody(call.body) });
    });

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/first/index.html" });
    const firstBody = requestBody(first.calls[1].body);
    expect(firstBody).toContain("allure-gitlab-summary:v1:dGVzdHM=:100:1000");

    mockEnv(mergeRequestEnv({ CI_PIPELINE_ID: "101", CI_JOB_ID: "1001" }));
    const second = stubRequest((call) => {
      if (call.method === "GET") {
        return notesResponse([{ id: 10, body: firstBody }]);
      }

      return jsonResponse({ id: 10, body: requestBody(call.body) });
    });

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/second/index.html" });
    const secondBody = requestBody(second.calls[1].body);
    expect(second.calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
    expect(second.calls[1].url).toBe("https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes/10");
    expect(secondBody).toContain("allure-gitlab-summary:v1:dGVzdHM=:101:1001");
    expect([...secondBody.matchAll(/allure-gitlab-summary:v1:/g)]).toHaveLength(1);
  });

  it("creates a separate note when existing owned notes belong to a different exact job name", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) => {
      if (call.method === "GET") {
        return notesResponse([{ id: 1, body: noteBody("100", "1000", "lint body", "bGludA==") }]);
      }

      if (call.method === "POST") {
        return jsonResponse({ id: 2, body: requestBody(call.body) });
      }

      throw new Error("unexpected request");
    });

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" });
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
    expect(requestBody(calls[1].body)).toContain("allure-gitlab-summary:v1:dGVzdHM=:100:1000");
  });

  it("posts the report URL when CI_JOB_URL is missing", async () => {
    mockEnv(mergeRequestEnv({ CI_JOB_URL: "" }));
    const { calls } = stubRequest((call) => (call.method === "GET" ? notesResponse([]) : jsonResponse({ id: 10 })));

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" });
    expect(requestBody(calls[1].body)).toBe(
      "<!-- allure-gitlab-summary:v1:dGVzdHM=:100:1000 -->\nhttps://reports.example/run/index.html",
    );
  });

  it("encodes marker delimiters, newlines and Unicode in job names without losing rolling ownership", async () => {
    mockEnv(mergeRequestEnv({ CI_JOB_NAME: "tests: -->\n/close 🧪" }));
    const first = stubRequest((call) => (call.method === "GET" ? notesResponse([]) : jsonResponse({ id: 10 })));
    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/first/index.html" });
    const body = requestBody(first.calls[1].body);
    expect(body.split("\n")[0]).toBe("<!-- allure-gitlab-summary:v1:dGVzdHM6IC0tPgovY2xvc2Ug8J+nqg==:100:1000 -->");
    expect(body).not.toContain("\n/close");

    mockEnv(mergeRequestEnv({ CI_JOB_NAME: "tests: -->\n/close 🧪", CI_JOB_ID: "1001" }));
    const second = stubRequest((call) =>
      call.method === "GET" ? notesResponse([{ id: 10, body }]) : jsonResponse({ id: 10 }),
    );
    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/retry/index.html" });
    expect(second.calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
    expect(second.calls[1].url).toBe("https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes/10");
  });

  it("does not adopt malformed markers or markers with an unsupported version", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) =>
      call.method === "GET"
        ? notesResponse([
            { id: 1, body: "<!-- allure-gitlab-summary:v0:dGVzdHM=:99:990 -->\nold version" },
            { id: 2, body: "<!-- allure-gitlab-summary:v1:dGVzdHM=:bad:990 -->\ninvalid ID" },
            { id: 3, body: "<!-- allure-gitlab-summary:v1:dGVzdHM=!:99:990 -->\ninvalid name" },
            { id: 4, body: "text\n<!-- allure-gitlab-summary:v1:dGVzdHM=:99:990 -->\nembedded marker" },
          ])
        : jsonResponse({ id: 10 }),
    );

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" });
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
  });

  it("updates an owned note idempotently for the same pipeline and job IDs", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) =>
      call.method === "GET"
        ? notesResponse([{ id: 5, body: noteBody("100", "1000", "same run") }])
        : jsonResponse({ id: 5, body: requestBody(call.body) }),
    );

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" });
    expect(calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
    expect(calls[1].url).toBe("https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes/5");
  });

  it.each([
    ["newer pipeline", noteBody("101", "900")],
    ["newer retry in the same pipeline", noteBody("100", "1001")],
  ])("rejects overwriting a %s note", async (_name, existingBody) => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) =>
      call.method === "GET" ? notesResponse([{ id: 5, body: existingBody }]) : jsonResponse({ ok: true }),
    );

    await expect(
      upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" }),
    ).rejects.toThrow("newer owned note exists");
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("follows complete note pagination and updates a note found on a later page", async () => {
    mockEnv(mergeRequestEnv());
    const unrelated = Array.from({ length: 100 }, (_value, index) => ({ id: index + 1, body: `unrelated ${index}` }));
    const { calls } = stubRequest((call) => {
      if (call.method === "GET" && call.url === notesPath(1)) {
        return notesResponse(unrelated, "2");
      }

      if (call.method === "GET" && call.url === notesPath(2)) {
        return notesResponse([{ id: 200, body: noteBody("99", "990") }]);
      }

      return jsonResponse({ id: 200, body: requestBody(call.body) });
    });

    await upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${notesPath(1)}`,
      `GET ${notesPath(2)}`,
      "PUT https://gitlab.example.com/api/v4/projects/1/merge_requests/7/notes/200",
    ]);
  });

  it("rejects creating a duplicate when the note scan is incomplete after five pages", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) => {
      if (call.method === "GET") {
        const page = Number(new URL(call.url).searchParams.get("page"));

        return notesResponse([], page === 5 ? "6" : String(page + 1));
      }

      return jsonResponse({ ok: true });
    });

    await expect(
      upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" }),
    ).rejects.toThrow("incomplete note scan");
    expect(calls.map((call) => call.method)).toEqual(["GET", "GET", "GET", "GET", "GET"]);
  });

  it("rejects creating a duplicate when a full note page omits pagination metadata", async () => {
    mockEnv(mergeRequestEnv());
    const fullPage = Array.from({ length: 100 }, (_value, index) => ({ id: index + 1, body: `unrelated ${index}` }));
    const { calls } = stubRequest((call) =>
      call.method === "GET" ? jsonResponse(fullPage) : jsonResponse({ ok: true }),
    );

    await expect(
      upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" }),
    ).rejects.toThrow("incomplete note scan");
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("rejects writing when pagination jumps over an unscanned page", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) => {
      if (call.method === "GET") {
        return notesResponse([], "3");
      }

      return jsonResponse({ ok: true });
    });

    await expect(
      upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" }),
    ).rejects.toThrow("incomplete note scan");
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("rejects cross-project merge requests before network I/O", async () => {
    mockEnv(mergeRequestEnv({ CI_MERGE_REQUEST_PROJECT_ID: "2" }));
    const { calls } = stubRequest(() => jsonResponse({ ok: true }));

    await expect(
      upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" }),
    ).rejects.toThrow("cross-project merge request");
    expect(calls).toHaveLength(0);
  });

  it("rejects before note writes for %s", async () => {
    mockEnv(mergeRequestEnv({ CI_MERGE_REQUEST_IID: "" }));
    const { calls } = stubRequest(() => jsonResponse({ ok: true }));

    await expect(
      upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" }),
    ).rejects.toThrow("missing merge request");
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed note payloads without writing", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) =>
      call.method === "GET" ? notesResponse([{ id: 1, body: 2 }]) : jsonResponse({ ok: true }),
    );

    await expect(
      upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" }),
    ).rejects.toThrow("invalid notes response");
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it.each([
    ["lookup", "GET"],
    ["create", "POST"],
    ["update", "PUT"],
  ])("propagates %s request failures", async (_name, failingMethod) => {
    const error = new Error("request failed");
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest((call) => {
      if (call.method === failingMethod) {
        throw error;
      }

      if (call.method === "GET") {
        return notesResponse(failingMethod === "PUT" ? [{ id: 9, body: noteBody("99", "990") }] : []);
      }

      return jsonResponse({ ok: true });
    });

    await expect(
      upsertGitlabJobNote({ token: apiToken, summary, reportUrl: "https://reports.example/run/index.html" }),
    ).rejects.toBe(error);
    expect(calls.some((call) => call.method === failingMethod)).toBe(true);
  });

  it.each(["", "not-a-url", "javascript:alert(1)", "https://user:password@reports.example/run/index.html"])(
    "rejects an invalid or unsafe report URL %j before network I/O",
    async (reportUrl) => {
      mockEnv(mergeRequestEnv());
      const { calls } = stubRequest(() => jsonResponse({ ok: true }));

      await expect(upsertGitlabJobNote({ token: apiToken, summary, reportUrl })).rejects.toThrow(/invalid.*URL/i);
      expect(calls).toHaveLength(0);
    },
  );

  it("rejects oversized comments before scanning notes", async () => {
    mockEnv(mergeRequestEnv());
    const { calls } = stubRequest(() => jsonResponse({ ok: true }));

    await expect(
      upsertGitlabJobNote({
        token: apiToken,
        summary,
        reportUrl: `https://reports.example/${"x".repeat(60_001)}/index.html`,
      }),
    ).rejects.toThrow("comment too large");
    expect(calls).toHaveLength(0);
  });
});
