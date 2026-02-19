/* eslint-disable max-lines */
import type { AllureHistory, AttachmentLinkLinked, HistoryDataPoint } from "@allurereport/core-api";
import { type AllureStoreDump, md5 } from "@allurereport/plugin-api";
import type { RawGlobals, RawTestAttachment, RawTestResult } from "@allurereport/reader-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { describe, expect, it, vi } from "vitest";
import { DefaultAllureStore, mapToObject, updateMapWithRecord } from "../../src/store/store.js";

class AllureTestHistory implements AllureHistory {
  constructor(readonly history: HistoryDataPoint[]) {}

  async readHistory(): Promise<HistoryDataPoint[]> {
    return this.history;
  }

  async appendHistory(): Promise<void> {}
}

const readerId = "store.test.ts";

describe("test results", () => {
  it("should return all test results", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
    };
    const tr2: RawTestResult = {
      name: "test result 2",
    };
    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const testResults = await store.allTestResults();

    expect(testResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test result 1",
        }),
        expect.objectContaining({
          name: "test result 2",
        }),
      ]),
    );
  });

  it("should return all test results except hidden", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      fullName: "foo",
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      fullName: "foo",
    };
    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const testResults = await store.allTestResults({ includeHidden: false });

    expect(testResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test result 2",
        }),
      ]),
    );
  });

  it("should return all test results include hidden", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      fullName: "foo",
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      fullName: "foo",
    };
    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const testResults = await store.allTestResults({ includeHidden: true });

    expect(testResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test result 1",
        }),
        expect.objectContaining({
          name: "test result 2",
        }),
      ]),
    );
  });

  it("should add test results", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "step 1",
          type: "step",
        },
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "text/plain",
        },
        {
          name: "step 2",
          type: "step",
          steps: [
            {
              name: "attachment 2",
              type: "attachment",
              originalFileName: "tr1-source2.xml",
              contentType: "application/xml",
            },
          ],
        },
      ],
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      steps: [
        {
          name: "step 1",
          type: "step",
        },
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr2-source1.txt",
          contentType: "text/plain",
        },
        {
          name: "step 2",
          type: "step",
          steps: [
            {
              name: "attachment 2",
              type: "attachment",
              originalFileName: "tr2-source2.json",
              contentType: "application/json",
            },
          ],
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const testResults = await store.allTestResults();

    expect(testResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test result 1",
        }),
        expect.objectContaining({
          name: "test result 2",
        }),
      ]),
    );
  });

  it("should calculate historyId for test results", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      testId: "some",
    };
    await store.visitTestResult(tr1, { readerId });

    const [tr] = await store.allTestResults();
    expect(tr).toMatchObject({
      historyId: `${md5("some")}.${md5("")}`,
    });
  });

  it("should mark retries as hidden", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      fullName: "sample test",
      start: 1000,
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      fullName: "sample test",
      start: 0,
    };

    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const testResults = await store.allTestResults();

    expect(testResults).toHaveLength(1);
    expect(testResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test result 1",
          hidden: false,
        }),
      ]),
    );
  });

  it("should not mark latest environment test result as retry", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "foo"),
        },
      },
    });
    const tr1: RawTestResult = {
      name: "test result 1",
      fullName: "sample test",
      labels: [],
    };
    const tr2: RawTestResult = {
      name: "test result 1",
      fullName: "sample test",
      labels: [{ name: "env", value: "foo" }],
    };

    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const testResults = await store.allTestResults();

    expect(testResults).toHaveLength(2);
    expect(testResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test result 1",
          hidden: false,
          environment: "default",
        }),
        expect.objectContaining({
          name: "test result 1",
          hidden: false,
          environment: "foo",
        }),
      ]),
    );
  });

  it("should mark retries as hidden for test result with different environments", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "foo"),
        },
      },
    });
    const tr1: RawTestResult = {
      name: "test result 1",
      fullName: "sample test",
      labels: [],
      start: 1000,
    };
    const tr2: RawTestResult = {
      name: "test result 1 retry",
      fullName: "sample test",
      labels: [],
      start: 0,
    };
    const tr3: RawTestResult = {
      name: "test result 2",
      fullName: "sample test",
      labels: [{ name: "env", value: "foo" }],
      start: 1000,
    };
    const tr4: RawTestResult = {
      name: "test result 2 retry",
      fullName: "sample test",
      labels: [{ name: "env", value: "foo" }],
      start: 0,
    };

    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });
    await store.visitTestResult(tr3, { readerId });
    await store.visitTestResult(tr4, { readerId });

    const testResults = await store.allTestResults();

    expect(testResults).toHaveLength(2);
    expect(testResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "test result 1",
          hidden: false,
          environment: "default",
        }),
        expect.objectContaining({
          name: "test result 2",
          hidden: false,
          environment: "foo",
        }),
      ]),
    );
  });
});

describe("attachments", () => {
  it("should index test result attachments", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "step 1",
          type: "step",
        },
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "text/plain",
        },
        {
          name: "step 2",
          type: "step",
          steps: [
            {
              name: "attachment 2",
              type: "attachment",
              originalFileName: "tr1-source2.xml",
              contentType: "application/xml",
            },
          ],
        },
      ],
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      steps: [
        {
          name: "step 1",
          type: "step",
        },
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr2-source1.txt",
          contentType: "text/plain",
        },
        {
          name: "step 2",
          type: "step",
          steps: [
            {
              name: "attachment 2",
              type: "attachment",
              originalFileName: "tr2-source2.json",
              contentType: "application/json",
            },
          ],
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const testResults = await store.allTestResults();
    const r1 = testResults.find((tr) => tr.name === "test result 1")!;

    const r1a = await store.attachmentsByTrId(r1.id);
    expect(r1a).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "attachment 1",
          contentType: "text/plain",
          originalFileName: "tr1-source1.txt",
        }),
        expect.objectContaining({
          name: "attachment 2",
          contentType: "application/xml",
          originalFileName: "tr1-source2.xml",
        }),
      ]),
    );
  });

  it("should index test result attachments when file already exists", async () => {
    const store = new DefaultAllureStore();

    const buffer1 = Buffer.from("some content", "utf-8");
    const buffer2 = Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + "<test/>\n", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    const rf2 = new BufferResultFile(buffer2, "tr1-source2.xml");
    await store.visitAttachmentFile(rf1);
    await store.visitAttachmentFile(rf2);

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "step 1",
          type: "step",
        },
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "text/plain",
        },
        {
          name: "step 2",
          type: "step",
          steps: [
            {
              name: "attachment 2",
              type: "attachment",
              originalFileName: "tr1-source2.xml",
              contentType: "application/xml",
            },
          ],
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const [r1] = await store.allTestResults();

    const r1a = await store.attachmentsByTrId(r1.id);
    expect(r1a).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "attachment 1",
          contentType: "text/plain",
          originalFileName: "tr1-source1.txt",
        }),
        expect.objectContaining({
          name: "attachment 2",
          contentType: "application/xml",
          originalFileName: "tr1-source2.xml",
        }),
      ]),
    );

    const a1 = r1a.find((r) => r.used && r.name === "attachment 1")!;
    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);

    const a2 = r1a.find((r) => r.used && r.name === "attachment 2")!;
    const a2Content = await store.attachmentContentById(a2.id);
    expect(a2Content).toEqual(rf2);
  });

  it("should ignore attachments not linked to test results", async () => {
    const store = new DefaultAllureStore();

    const buffer1 = Buffer.from("some content", "utf-8");
    const buffer2 = Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + "<test/>\n", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    const rf2 = new BufferResultFile(buffer2, "tr1-invalid.xml");
    await store.visitAttachmentFile(rf1);
    await store.visitAttachmentFile(rf2);

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "step 1",
          type: "step",
        },
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "text/plain",
        },
        {
          name: "step 2",
          type: "step",
          steps: [
            {
              name: "attachment 2",
              type: "attachment",
              originalFileName: "tr1-source2.xml",
              contentType: "application/xml",
            },
          ],
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const [r1] = await store.allTestResults();

    const r1a = await store.attachmentsByTrId(r1.id);
    expect(r1a).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "attachment 1",
          contentType: "text/plain",
          originalFileName: "tr1-source1.txt",
        }),
        expect.objectContaining({
          name: "attachment 2",
          contentType: "application/xml",
          originalFileName: "tr1-source2.xml",
        }),
      ]),
    );

    const a1 = r1a.find((r) => r.used && r.name === "attachment 1")!;
    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);

    const a2 = r1a.find((r) => r.used && r.name === "attachment 2")!;
    const a2Content = await store.attachmentContentById(a2.id);
    expect(a2Content).toBeUndefined();
  });

  it("should mark used and missed attachments", async () => {
    const store = new DefaultAllureStore();

    const buffer1 = Buffer.from("some content", "utf-8");
    const buffer2 = Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + "<test/>\n", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    const rf2 = new BufferResultFile(buffer2, "tr1-invalid.xml");
    await store.visitAttachmentFile(rf1);
    await store.visitAttachmentFile(rf2);

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "step 1",
          type: "step",
        },
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "text/plain",
        },
        {
          name: "step 2",
          type: "step",
          steps: [
            {
              name: "attachment 2",
              type: "attachment",
              originalFileName: "tr1-source2.xml",
              contentType: "application/xml",
            },
          ],
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const allAttachments = await store.allAttachments({ includeUnused: true, includeMissed: true });
    expect(allAttachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "attachment 1",
          contentType: "text/plain",
          originalFileName: "tr1-source1.txt",
          used: true,
          missed: false,
        }),
        expect.objectContaining({
          name: "attachment 2",
          contentType: "application/xml",
          originalFileName: "tr1-source2.xml",
          missed: true,
          used: true,
        }),
        expect.objectContaining({
          contentType: "application/xml",
          originalFileName: "tr1-invalid.xml",
          used: false,
          missed: false,
        }),
      ]),
    );

    const a1 = allAttachments.find((r) => r.used && r.name === "attachment 1")!;
    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);

    const a2 = allAttachments.find((r) => r.used && r.name === "attachment 2")!;
    const a2Content = await store.attachmentContentById(a2.id);
    expect(a2Content).toBeUndefined();

    const a3 = allAttachments.find((r) => !r.used)!;
    const a3Content = await store.attachmentContentById(a3.id);
    expect(a3Content).toEqual(rf2);
  });

  it("should detect content type for visited result files", async () => {
    const store = new DefaultAllureStore();

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);

    const [a1] = await store.allAttachments({ includeUnused: true, includeMissed: true });
    expect(a1).toEqual(
      expect.objectContaining({
        contentType: "text/plain",
        originalFileName: "tr1-source1.txt",
        used: false,
        missed: false,
      }),
    );

    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);
  });

  it("should store specified content type in link", async () => {
    const store = new DefaultAllureStore();

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const [a1] = await store.allAttachments({ includeUnused: true, includeMissed: true });
    expect(a1).toEqual(
      expect.objectContaining({
        name: "attachment 1",
        contentType: "application/vnd.allure.test",
        originalFileName: "tr1-source1.txt",
        used: true,
        missed: true,
      }),
    );
  });

  it("should not override content type for existing links when processing file", async () => {
    const store = new DefaultAllureStore();

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);

    const [a1] = await store.allAttachments({ includeUnused: true, includeMissed: true });
    expect(a1).toEqual(
      expect.objectContaining({
        name: "attachment 1",
        contentType: "application/vnd.allure.test",
        originalFileName: "tr1-source1.txt",
        used: true,
        missed: false,
      }),
    );

    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);
  });

  it("should override content type for existing attachment files when processing link", async () => {
    const store = new DefaultAllureStore();

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const [a1] = await store.allAttachments({ includeUnused: true, includeMissed: true });
    expect(a1).toEqual(
      expect.objectContaining({
        name: "attachment 1",
        contentType: "application/vnd.allure.test",
        originalFileName: "tr1-source1.txt",
        used: true,
        missed: false,
      }),
    );

    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);
  });

  it("should override file on second processing", async () => {
    const store = new DefaultAllureStore();

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    const rf2 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);
    await store.visitAttachmentFile(rf2);

    const [a1] = await store.allAttachments({ includeUnused: true, includeMissed: true });
    expect(a1).toEqual(
      expect.objectContaining({
        name: "attachment 1",
        contentType: "application/vnd.allure.test",
        contentLength: rf2.getContentLength(),
        originalFileName: "tr1-source1.txt",
        used: true,
        missed: false,
      }),
    );

    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf2);
  });

  it("should ignore duplicate attachment links", async () => {
    const store = new DefaultAllureStore();

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);

    const tr2: RawTestResult = {
      name: "test result 2",
      steps: [
        {
          name: "other attachment",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.x-test",
        },
      ],
    };
    await store.visitTestResult(tr2, { readerId });

    const [a1] = await store.allAttachments({ includeUnused: true, includeMissed: true });
    expect(a1).toEqual(
      expect.objectContaining({
        name: "attachment 1",
        contentType: "application/vnd.allure.test",
        contentLength: rf1.getContentLength(),
        originalFileName: "tr1-source1.txt",
        used: true,
        missed: false,
      }),
    );

    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);

    const allTr = await store.allTestResults();
    const r1 = allTr.find((tr) => tr.name === "test result 2")!;
    expect(r1.steps).toEqual(
      expect.arrayContaining([
        {
          type: "attachment",
          link: expect.objectContaining({
            id: expect.any(String),
            used: true,
            missed: true,
            contentType: "application/vnd.allure.x-test",
            name: "other attachment",
            originalFileName: undefined,
            ext: "",
          }),
        },
      ]),
    );
  });

  it("should not return unused or missed attachments by default", async () => {
    const store = new DefaultAllureStore();

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
        {
          name: "attachment 2",
          type: "attachment",
          originalFileName: "tr1-missed.xml",
          contentType: "application/xml",
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);

    const rf2 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf2);

    const [a1] = await store.allAttachments();
    expect(a1).toEqual(
      expect.objectContaining({
        name: "attachment 1",
        contentType: "application/vnd.allure.test",
        originalFileName: "tr1-source1.txt",
        used: true,
        missed: false,
      }),
    );

    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);
  });

  it("should return unused attachments if specified", async () => {
    const store = new DefaultAllureStore();

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
        {
          name: "attachment 2",
          type: "attachment",
          originalFileName: "tr1-missed.xml",
          contentType: "application/xml",
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);

    const rf2 = new BufferResultFile(buffer1, "other.xml");
    await store.visitAttachmentFile(rf2);

    const attachments = await store.allAttachments({ includeUnused: true });
    expect(attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "attachment 1",
          contentType: "application/vnd.allure.test",
          originalFileName: "tr1-source1.txt",
          ext: ".txt",
          used: true,
          missed: false,
        }),
        expect.objectContaining({
          contentType: "application/xml",
          originalFileName: "other.xml",
          ext: ".xml",
          used: false,
          missed: false,
        }),
      ]),
    );

    const a1 = attachments.find((r) => r.used && r.name === "attachment 1")!;
    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);

    const a2 = attachments.find((r) => !r.used)!;
    const a2Content = await store.attachmentContentById(a2.id);
    expect(a2Content).toEqual(rf2);
  });

  it("should return missed attachments if specified", async () => {
    const store = new DefaultAllureStore();

    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
        {
          name: "attachment 2",
          type: "attachment",
          originalFileName: "tr1-missed.xml",
          contentType: "application/xml",
        },
      ],
    };
    await store.visitTestResult(tr1, { readerId });

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);

    const rf2 = new BufferResultFile(buffer1, "other.xml");
    await store.visitAttachmentFile(rf2);

    const attachments = await store.allAttachments({ includeMissed: true });
    expect(attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "attachment 1",
          contentType: "application/vnd.allure.test",
          originalFileName: "tr1-source1.txt",
          ext: ".txt",
          used: true,
          missed: false,
        }),
        expect.objectContaining({
          name: "attachment 2",
          contentType: "application/xml",
          originalFileName: "tr1-missed.xml",
          ext: ".xml",
          used: true,
          missed: true,
        }),
      ]),
    );

    const a1 = attachments.find((r) => r.used && r.name === "attachment 1")!;
    const a1Content = await store.attachmentContentById(a1.id);
    expect(a1Content).toEqual(rf1);
  });

  it("should use content type detected from file in case no type specified in link", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
        },
      ],
    };

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);
    await store.visitTestResult(tr1, { readerId });

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1.txt",
      contentType: "text/plain",
    });
  });

  it("should use content type from link if specified", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentType: "application/vnd.allure.test",
        },
      ],
    };

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);
    await store.visitTestResult(tr1, { readerId });

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1.txt",
      contentType: "application/vnd.allure.test",
    });
  });

  it("should use content length from linked file", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
          contentLength: 12345,
        },
      ],
    };

    const buffer1 = Buffer.from("some content", "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);
    await store.visitTestResult(tr1, { readerId });

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1.txt",
      contentType: "text/plain",
      contentLength: buffer1.length,
    });
  });

  it("should update link in steps when attachment file arrives second", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
        },
      ],
    };

    const buffer1 = Buffer.from("some content", "utf-8");
    await store.visitTestResult(tr1, { readerId });

    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);

    const [tr] = await store.allTestResults();
    const [step] = tr.steps;

    expect(step).toEqual({
      link: expect.objectContaining({
        id: md5("tr1-source1.txt"),
        name: "attachment 1",
        originalFileName: "tr1-source1.txt",
        contentType: "text/plain",
        contentLength: buffer1.length,
        ext: ".txt",
        missed: false,
        used: true,
      }),
      type: "attachment",
    });
  });

  it("should use extension from original file name if any (link first)", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
        },
      ],
    };

    const buffer1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitTestResult(tr1, { readerId });
    await store.visitAttachmentFile(rf1);

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1.txt",
      ext: ".txt",
    });
  });

  it("should use extension from original file name if any (file first)", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1.txt",
        },
      ],
    };

    const buffer1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf1);
    await store.visitTestResult(tr1, { readerId });

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1.txt",
      ext: ".txt",
    });
  });

  it("should use extension based on content type specified in link if file without extension (link first)", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1",
          contentType: "text/plain",
        },
      ],
    };

    const buffer1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1");
    await store.visitTestResult(tr1, { readerId });
    await store.visitAttachmentFile(rf1);

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1",
      ext: ".txt",
    });
  });

  it("should use extension based on content type specified in link if file without extension (file first)", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1",
          contentType: "text/plain",
        },
      ],
    };

    const buffer1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1");
    await store.visitAttachmentFile(rf1);
    await store.visitTestResult(tr1, { readerId });

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1",
      ext: ".txt",
    });
  });

  it("should use extension based on detected content type if no extension and content type specified in link (link first)", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1",
        },
      ],
    };

    const buffer1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1");
    await store.visitTestResult(tr1, { readerId });
    await store.visitAttachmentFile(rf1);

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1",
      contentType: "image/svg+xml",
      ext: ".svg",
    });
  });

  it("should use extension based on detected content type if no extension and content type specified in link (file first)", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      steps: [
        {
          name: "attachment 1",
          type: "attachment",
          originalFileName: "tr1-source1",
        },
      ],
    };

    const buffer1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf-8");
    const rf1 = new BufferResultFile(buffer1, "tr1-source1");
    await store.visitAttachmentFile(rf1);
    await store.visitTestResult(tr1, { readerId });

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1",
      contentType: "image/svg+xml",
      ext: ".svg",
    });
  });
});

describe("history", () => {
  it("should return history data points sorted by timestamp", async () => {
    const history = [
      {
        uuid: "hp1",
        name: "Allure Report",
        timestamp: 123,
        testResults: {},
        knownTestCaseIds: [],
        metrics: {},
      },
      {
        uuid: "hp2",
        name: "Allure Report",
        timestamp: 41834521,
        testResults: {},
        knownTestCaseIds: [],
        metrics: {},
      },
      {
        uuid: "hp3",
        name: "Allure Report",
        timestamp: 21,
        testResults: {},
        knownTestCaseIds: [],
        metrics: {},
      },
    ] as unknown as HistoryDataPoint[];
    const testHistory = new AllureTestHistory(history);
    const store = new DefaultAllureStore({
      history: testHistory,
    });

    await store.readHistory();

    const historyDataPoints = await store.allHistoryDataPoints();

    expect(historyDataPoints).toEqual([
      expect.objectContaining({
        uuid: "hp2",
      }),
      expect.objectContaining({
        uuid: "hp1",
      }),
      expect.objectContaining({
        uuid: "hp3",
      }),
    ]);
  });

  it("should return empty history data if no history is provided", async () => {
    const history: HistoryDataPoint[] = [];
    const testHistory = new AllureTestHistory(history);
    const store = new DefaultAllureStore({
      history: testHistory,
    });

    await store.readHistory();

    const historyDataPoints = await store.allHistoryDataPoints();

    expect(historyDataPoints).toHaveLength(0);
  });

  it("should return empty history for test result if no history data is found", async () => {
    const history = [
      {
        uuid: "hp1",
        name: "Allure Report",
        timestamp: 123,
        testResults: {
          other: {
            id: "some-id",
            name: "some-name",
            status: "passed",
          },
        },
        knownTestCaseIds: [],
        metrics: {},
      },
    ] as unknown as HistoryDataPoint[];
    const testHistory = new AllureTestHistory(history);
    const store = new DefaultAllureStore({
      history: testHistory,
    });

    await store.readHistory();

    const tr1: RawTestResult = {
      name: "test result 1",
      historyId: "some",
    };

    await store.visitTestResult(tr1, { readerId });

    const [tr] = await store.allTestResults();
    const historyTestResults = await store.historyByTrId(tr.id);

    expect(historyTestResults).toHaveLength(0);
  });

  it("should return history for test result", async () => {
    const testId = "some-test-id";
    const historyId = `${md5(testId)}.${md5("")}`;
    const history = [
      {
        uuid: "hp1",
        name: "Allure Report",
        timestamp: 123,
        testResults: {
          [historyId]: {
            id: "some-id",
            name: "some-name",
            status: "passed",
          },
        },
        knownTestCaseIds: [],
        metrics: {},
      },
    ] as unknown as HistoryDataPoint[];
    const testHistory = new AllureTestHistory(history);
    const store = new DefaultAllureStore({
      history: testHistory,
    });

    await store.readHistory();

    const tr1: RawTestResult = {
      name: "test result 1",
      testId,
    };

    await store.visitTestResult(tr1, { readerId });

    const [tr] = await store.allTestResults();
    const historyTestResults = await store.historyByTrId(tr.id);

    expect(historyTestResults).toEqual([
      expect.objectContaining({
        id: "some-id",
        name: "some-name",
        status: "passed",
      }),
    ]);
  });

  it("should return history for test result sorted by timestamp desc", async () => {
    const testId = "some-test-id";
    const historyId = `${md5(testId)}.${md5("")}`;
    const now = Date.now();
    const history = [
      {
        uuid: "hp1",
        name: "Allure Report",
        timestamp: now - 10000,
        testResults: {
          [historyId]: {
            id: "some-id1",
            name: "some-name",
            status: "broken",
          },
        },
        knownTestCaseIds: [],
        metrics: {},
      },
      {
        uuid: "hp3",
        name: "Allure Report",
        timestamp: now,
        testResults: {
          [historyId]: {
            id: "some-id3",
            name: "some-name",
            status: "passed",
          },
        },
        knownTestCaseIds: [],
        metrics: {},
      },
      {
        uuid: "hp2",
        name: "Allure Report",
        timestamp: now - 1000,
        testResults: {
          [historyId]: {
            id: "some-id2",
            name: "some-name",
            status: "failed",
          },
        },
        knownTestCaseIds: [],
        metrics: {},
      },
    ] as unknown as HistoryDataPoint[];
    const testHistory = new AllureTestHistory(history);
    const store = new DefaultAllureStore({
      history: testHistory,
    });

    await store.readHistory();

    const tr1: RawTestResult = {
      name: "test result 1",
      testId,
    };
    await store.visitTestResult(tr1, { readerId });

    const [tr] = await store.allTestResults();

    const historyTestResults = await store.historyByTrId(tr.id);

    expect(historyTestResults).toEqual([
      expect.objectContaining({
        id: "some-id3",
        name: "some-name",
        status: "passed",
      }),
      expect.objectContaining({
        id: "some-id2",
        name: "some-name",
        status: "failed",
      }),
      expect.objectContaining({
        id: "some-id1",
        name: "some-name",
        status: "broken",
      }),
    ]);
  });

  it("should return history for test result ignoring missed history data points", async () => {
    const testId = "some-test-id";
    const historyId = `${md5(testId)}.${md5("")}`;
    const now = Date.now();
    const history = [
      {
        uuid: "hp1",
        name: "Allure Report",
        timestamp: now - 10000,
        testResults: {
          [historyId]: {
            id: "some-id1",
            name: "some-name",
            status: "broken",
          },
        },
        knownTestCaseIds: [],
        metrics: {},
      },
      {
        uuid: "hp3",
        name: "Allure Report",
        timestamp: now,
        testResults: {
          [historyId]: {
            id: "some-id3",
            name: "some-name",
            status: "passed",
          },
        },
        knownTestCaseIds: [],
        metrics: {},
      },
      {
        uuid: "hp2",
        name: "Allure Report",
        timestamp: now - 1000,
        testResults: {
          other: {
            id: "some-id2",
            name: "some-name",
            status: "failed",
          },
        },
        knownTestCaseIds: [],
        metrics: {},
      },
    ] as unknown as HistoryDataPoint[];
    const testHistory = new AllureTestHistory(history);
    const store = new DefaultAllureStore({
      history: testHistory,
    });

    await store.readHistory();

    const tr1: RawTestResult = {
      name: "test result 1",
      testId,
    };
    await store.visitTestResult(tr1, { readerId });

    const [tr] = await store.allTestResults();

    const historyTestResults = await store.historyByTrId(tr.id);

    expect(historyTestResults).toEqual([
      expect.objectContaining({
        id: "some-id3",
        name: "some-name",
        status: "passed",
      }),
      expect.objectContaining({
        id: "some-id1",
        name: "some-name",
        status: "broken",
      }),
    ]);
  });
});

describe("environments", () => {
  it("should set environment to test result on visit when they are specified", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: ({ labels }) => !!labels.find(({ name, value }) => name === "env" && value === "foo"),
        },
      },
    });
    const rawTr1: RawTestResult = {
      name: "test result 1",
      labels: [
        {
          name: "env",
          value: "foo",
        },
      ],
    };
    const rawTr2: RawTestResult = {
      name: "test result 2",
      labels: [
        {
          name: "env",
          value: "bar",
        },
      ],
    };

    await store.visitTestResult(rawTr1, { readerId });
    await store.visitTestResult(rawTr2, { readerId });

    const [tr1, tr2] = await store.allTestResults();

    expect(tr1).toMatchObject({
      name: rawTr1.name,
      environment: "foo",
    });
    expect(tr2).toMatchObject({
      name: rawTr2.name,
      environment: "default",
    });
  });

  it("should set default environment event when environments are not specified", async () => {
    const store = new DefaultAllureStore();
    const rawTr1: RawTestResult = {
      name: "test result 1",
    };
    const rawTr2: RawTestResult = {
      name: "test result 2",
    };

    await store.visitTestResult(rawTr1, { readerId });
    await store.visitTestResult(rawTr2, { readerId });

    const [tr1, tr2] = await store.allTestResults();

    expect(tr1).toMatchObject({
      name: rawTr1.name,
      environment: "default",
    });
    expect(tr2).toMatchObject({
      name: rawTr2.name,
      environment: "default",
    });
  });

  it("should return all environments", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: () => true,
        },
      },
    });
    const result = await store.allEnvironments();

    expect(result).toEqual(["default", "foo"]);
  });

  it("should return test results for given environment", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: ({ labels }) => !!labels.find(({ name, value }) => name === "env" && value === "foo"),
        },
      },
    });
    const rawTr1: RawTestResult = {
      name: "test result 1",
      labels: [
        {
          name: "env",
          value: "foo",
        },
      ],
    };
    const rawTr2: RawTestResult = {
      name: "test result 2",
      labels: [
        {
          name: "env",
          value: "bar",
        },
      ],
    };

    await store.visitTestResult(rawTr1, { readerId });
    await store.visitTestResult(rawTr2, { readerId });

    expect(await store.testResultsByEnvironment("foo")).toEqual([
      expect.objectContaining({
        name: rawTr1.name,
      }),
    ]);
    expect(await store.testResultsByEnvironment("default")).toEqual([
      expect.objectContaining({
        name: rawTr2.name,
      }),
    ]);
  });

  it("should return an empty array for unknown environment", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: () => true,
        },
      },
    });
    const result = await store.testResultsByEnvironment("unknown");

    expect(result).toEqual([]);
  });

  it("should return all test env groups", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: ({ labels }) => !!labels.find(({ name, value }) => name === "env" && value === "foo"),
        },
      },
    });
    const rawTr1: RawTestResult = {
      name: "test result 1",
      fullName: "test result 1",
      status: "passed",
      testId: "test result id 1",
      labels: [
        {
          name: "env",
          value: "foo",
        },
      ],
    };
    const rawTr2: RawTestResult = {
      name: "test result 1",
      fullName: "test result 1",
      status: "failed",
      testId: "test result id 1",
      labels: [],
    };
    const rawTr3: RawTestResult = {
      name: "test result 2",
      fullName: "test result 2",
      testId: "test result id 2",
      status: "passed",
      labels: [
        {
          name: "env",
          value: "bar",
        },
      ],
    };

    await store.visitTestResult(rawTr1, { readerId });
    await store.visitTestResult(rawTr2, { readerId });
    await store.visitTestResult(rawTr3, { readerId });

    const [tr1, tr2, tr3] = await store.allTestResults({ includeHidden: true });
    const result = await store.allTestEnvGroups();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: "test result 1",
      status: "failed",
      testResultsByEnv: {
        foo: tr1.id,
        default: tr2.id,
      },
    });
    expect(result[1]).toMatchObject({
      name: "test result 2",
      status: "passed",
      testResultsByEnv: {
        default: tr3.id,
      },
    });
  });
});

describe("visitGlobals", () => {
  it("should add global errors", async () => {
    const store = new DefaultAllureStore();
    const globals: RawGlobals = {
      errors: [
        { message: "Setup failed", trace: "Error at setup.js:10" },
        { message: "Teardown failed", trace: "Error at teardown.js:5" },
      ],
      attachments: [],
    };

    await store.visitGlobals(globals);

    const errors = await store.allGlobalErrors();

    expect(errors).toHaveLength(2);
    expect(errors).toEqual([
      { message: "Setup failed", trace: "Error at setup.js:10" },
      { message: "Teardown failed", trace: "Error at teardown.js:5" },
    ]);
  });

  it("should add global attachments", async () => {
    const store = new DefaultAllureStore();
    const globals: RawGlobals = {
      errors: [],
      attachments: [
        { name: "log file", originalFileName: "global-log.txt", contentType: "text/plain" } as RawTestAttachment,
        { name: "screenshot", originalFileName: "global-screen.png", contentType: "image/png" } as RawTestAttachment,
      ],
    };

    await store.visitGlobals(globals);

    const attachments = await store.allGlobalAttachments();

    expect(attachments).toHaveLength(2);
    expect(attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: md5("global-log.txt"),
          name: "log file",
          originalFileName: "global-log.txt",
          ext: ".txt",
          contentType: "text/plain",
          used: true,
          missed: false,
        }),
        expect.objectContaining({
          id: md5("global-screen.png"),
          name: "screenshot",
          originalFileName: "global-screen.png",
          ext: ".png",
          contentType: "image/png",
          used: true,
          missed: false,
        }),
      ]),
    );
  });

  it("should use originalFileName as name when name is not provided", async () => {
    const store = new DefaultAllureStore();
    const globals: RawGlobals = {
      errors: [],
      attachments: [{ originalFileName: "output.log" } as RawTestAttachment],
    };

    await store.visitGlobals(globals);

    const [attachment] = await store.allGlobalAttachments();

    expect(attachment).toMatchObject({
      name: "output.log",
      originalFileName: "output.log",
    });
  });

  it("should add both errors and attachments at the same time", async () => {
    const store = new DefaultAllureStore();
    const globals: RawGlobals = {
      errors: [{ message: "Something went wrong" }],
      attachments: [
        { name: "debug log", originalFileName: "debug.txt", contentType: "text/plain" } as RawTestAttachment,
      ],
    };

    await store.visitGlobals(globals);

    const errors = await store.allGlobalErrors();
    const attachments = await store.allGlobalAttachments();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ message: "Something went wrong" });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      name: "debug log",
      originalFileName: "debug.txt",
    });
  });

  it("should accumulate globals across multiple calls", async () => {
    const store = new DefaultAllureStore();

    await store.visitGlobals({
      errors: [{ message: "Error 1" }],
      attachments: [{ originalFileName: "file1.txt" } as RawTestAttachment],
    });
    await store.visitGlobals({
      errors: [{ message: "Error 2" }],
      attachments: [{ originalFileName: "file2.txt" } as RawTestAttachment],
    });

    const errors = await store.allGlobalErrors();
    const attachments = await store.allGlobalAttachments();

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({ message: "Error 1" });
    expect(errors[1]).toEqual({ message: "Error 2" });
    expect(attachments).toHaveLength(2);
  });

  it("should handle empty globals", async () => {
    const store = new DefaultAllureStore();
    const globals: RawGlobals = {
      errors: [],
      attachments: [],
    };

    await store.visitGlobals(globals);

    const errors = await store.allGlobalErrors();
    const attachments = await store.allGlobalAttachments();

    expect(errors).toHaveLength(0);
    expect(attachments).toHaveLength(0);
  });

  it("should make global attachments available in allAttachments", async () => {
    const store = new DefaultAllureStore();
    const globals: RawGlobals = {
      errors: [],
      attachments: [
        { name: "global log", originalFileName: "global.txt", contentType: "text/plain" } as RawTestAttachment,
      ],
    };

    await store.visitGlobals(globals);

    const allAttachments = await store.allAttachments({ includeUnused: true, includeMissed: true });

    expect(allAttachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "global log",
          originalFileName: "global.txt",
          used: true,
        }),
      ]),
    );
  });

  it("should include global attachments and errors in dump state", async () => {
    const store = new DefaultAllureStore();

    await store.visitGlobals({
      errors: [{ message: "Global error" }],
      attachments: [{ name: "log", originalFileName: "global.log", contentType: "text/plain" } as RawTestAttachment],
    });

    const dump = store.dumpState();

    expect(dump.globalAttachmentIds).toHaveLength(1);
    expect(dump.globalErrors).toHaveLength(1);
    expect(dump.globalErrors[0]).toEqual({ message: "Global error" });

    const attachmentId = dump.globalAttachmentIds[0];

    expect(dump.attachments[attachmentId]).toMatchObject({
      name: "log",
      originalFileName: "global.log",
    });
  });
});

describe("variables", () => {
  it("should return all report variables", async () => {
    const fixture = {
      foo: "bar",
    };
    const store = new DefaultAllureStore({
      reportVariables: fixture,
    });
    const result = await store.allVariables();

    expect(result).toEqual(fixture);
  });

  it("should return empty object when variables aren't provided", async () => {
    const store = new DefaultAllureStore();
    const result = await store.allVariables();

    expect(result).toEqual({});
  });

  it("should return variables for a specific environment, including report-wide variables", async () => {
    const fixtures = {
      report: {
        foo: "bar",
      },
      env: {
        bar: "baz",
      },
    };
    const store = new DefaultAllureStore({
      reportVariables: fixtures.report,
      environmentsConfig: {
        foo: {
          variables: fixtures.env,
          matcher: () => true,
        },
      },
    });
    const result = await store.envVariables("foo");

    expect(result).toEqual({
      ...fixtures.report,
      ...fixtures.env,
    });
  });

  it("should return report-wide variables for the default environment", async () => {
    const fixture = {
      foo: "bar",
    };
    const store = new DefaultAllureStore({
      reportVariables: fixture,
    });
    const result = await store.envVariables("default");

    expect(result).toEqual(fixture);
  });
});

describe("dump state", () => {
  it("should allow to dump store state", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      fullName: "full test result 1",
      status: "passed",
      testId: "test-id-1",
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      fullName: "full test result 2",
      status: "failed",
      testId: "test-id-2",
    };

    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const attachmentFile = new BufferResultFile(Buffer.from("test content"), "attachment.txt");
    const attachmentId = md5(attachmentFile.getOriginalFileName());

    await store.visitAttachmentFile(attachmentFile);

    const testResults = await store.allTestResults();
    const attachments = await store.allAttachments({
      includeMissed: false,
      includeUnused: true,
    });
    const dump = store.dumpState();

    testResults.forEach((tr) => {
      dump.testResults[tr.id] = tr;
    });
    attachments.forEach((attachment) => {
      dump.attachments[attachment.id] = attachment;
    });

    expect(dump).toBeDefined();
    expect(Object.keys(dump.testResults).length).toBe(2);
    expect(Object.keys(dump.attachments).length).toBe(1);
    expect(dump.attachments[attachmentId]).toBeDefined();
    expect(dump.environments).toContain("default");
    expect(dump.reportVariables).toEqual({});
    expect(dump.indexAttachmentByTestResult).toBeDefined();
    expect(dump.indexTestResultByHistoryId).toBeDefined();
    expect(dump.indexTestResultByTestCase).toBeDefined();
    expect(dump.indexLatestEnvTestResultByHistoryId).toBeDefined();
    expect(dump.indexAttachmentByFixture).toBeDefined();
    expect(dump.indexFixturesByTestResult).toBeDefined();
    expect(dump.indexKnownByHistoryId).toBeDefined();
    expect(dump.qualityGateResults).toEqual([]);
  });

  it("should include globalAttachments and globalErrors in dump state", async () => {
    const mockRealtimeSubscriber = {
      onQualityGateResults: vi.fn(),
      onGlobalExitCode: vi.fn(),
      onGlobalError: vi.fn(),
      onGlobalAttachment: vi.fn(),
    };
    const store = new DefaultAllureStore({
      realtimeSubscriber: mockRealtimeSubscriber as any,
    });
    const tr1: RawTestResult = {
      name: "test result 1",
      fullName: "full test result 1",
      status: "passed",
      testId: "test-id-1",
    };

    await store.visitTestResult(tr1, { readerId });

    const globalError1 = {
      message: "Global setup error",
      trace: "Error stack trace 1",
    };
    const globalError2 = {
      message: "Global teardown error",
      trace: "Error stack trace 2",
    };
    const onGlobalErrorCallback = mockRealtimeSubscriber.onGlobalError.mock.calls[0][0];

    await onGlobalErrorCallback(globalError1);
    await onGlobalErrorCallback(globalError2);

    const mockGlobalAttachmentFile1 = {
      getOriginalFileName: () => "global-log.txt",
      getExtension: () => ".txt",
      getContentType: () => "text/plain",
      getContentLength: () => 100,
    };
    const mockGlobalAttachmentFile2 = {
      getOriginalFileName: () => "global-screenshot.png",
      getExtension: () => ".png",
      getContentType: () => "image/png",
      getContentLength: () => 2048,
    };
    const onGlobalAttachmentCallback = mockRealtimeSubscriber.onGlobalAttachment.mock.calls[0][0];

    await onGlobalAttachmentCallback({ attachment: mockGlobalAttachmentFile1 });
    await onGlobalAttachmentCallback({ attachment: mockGlobalAttachmentFile2 });

    const dump = store.dumpState();

    expect(dump.globalAttachmentIds).toHaveLength(2);
    expect((dump.attachments[dump.globalAttachmentIds[0]] as AttachmentLinkLinked).name).toBe("global-log.txt");
    expect((dump.attachments[dump.globalAttachmentIds[1]] as AttachmentLinkLinked).name).toBe("global-screenshot.png");
    expect(dump.globalErrors).toHaveLength(2);
    expect(dump.globalErrors).toEqual([globalError1, globalError2]);
    expect(dump.qualityGateResults).toEqual([]);
  });

  it("should include qualityGateResults in dump state", async () => {
    const mockRealtimeSubscriber = {
      onQualityGateResults: vi.fn(),
      onGlobalExitCode: vi.fn(),
      onGlobalError: vi.fn(),
      onGlobalAttachment: vi.fn(),
    };
    const store = new DefaultAllureStore({
      realtimeSubscriber: mockRealtimeSubscriber as any,
    });
    const qualityGateResult1 = {
      success: true,
      expected: 0,
      actual: 0,
      rule: "failed",
      message: "No failed tests",
      environment: "default",
    };
    const qualityGateResult2 = {
      success: false,
      expected: 100,
      actual: 80,
      rule: "coverage",
      message: "Coverage is below threshold",
      environment: "staging",
    };

    const onQualityGateResultsCallback = mockRealtimeSubscriber.onQualityGateResults.mock.calls[0][0];

    await onQualityGateResultsCallback([qualityGateResult1, qualityGateResult2]);

    const dump = store.dumpState();

    expect(dump.qualityGateResults).toHaveLength(2);
    expect(dump.qualityGateResults).toEqual([qualityGateResult1, qualityGateResult2]);
  });

  it("should include empty arrays for globalAttachments and globalErrors when none exist", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      status: "passed",
    };

    await store.visitTestResult(tr1, { readerId });

    const dump = store.dumpState();

    expect(dump.globalAttachmentIds).toEqual([]);
    expect(dump.globalErrors).toEqual([]);
    expect(dump.qualityGateResults).toEqual([]);
    expect(dump.indexAttachmentByTestResult).toBeDefined();
    expect(dump.indexTestResultByHistoryId).toBeDefined();
    expect(dump.indexTestResultByTestCase).toBeDefined();
    expect(dump.indexLatestEnvTestResultByHistoryId).toBeDefined();
    expect(dump.indexAttachmentByFixture).toBeDefined();
    expect(dump.indexFixturesByTestResult).toBeDefined();
    expect(dump.indexKnownByHistoryId).toBeDefined();
  });

  it("should restore globalAttachments and globalErrors from dump", async () => {
    const globalAttachment1 = {
      id: "global-attachment-1",
      originalFileName: "global-log.txt",
      contentType: "text/plain",
      ext: ".txt",
      used: false,
      missed: false,
      contentLength: 100,
    };
    const globalAttachment2 = {
      id: "global-attachment-2",
      originalFileName: "global-screenshot.png",
      contentType: "image/png",
      ext: ".png",
      used: false,
      missed: false,
      contentLength: 2048,
    };
    const globalError1 = {
      message: "Global setup error",
      trace: "Error stack trace 1",
    };
    const globalError2 = {
      message: "Global teardown error",
      trace: "Error stack trace 2",
    };
    const testResult = {
      id: "test-result-id",
      name: "test result",
      fullName: "test result",
      status: "passed",
    };
    const dump = {
      testResults: {
        "test-result-id": testResult,
      },
      attachments: {
        [globalAttachment1.id]: globalAttachment1,
        [globalAttachment2.id]: globalAttachment2,
      },
      testCases: {},
      fixtures: {},
      environments: ["default"],
      reportVariables: {},
      globalAttachmentIds: [globalAttachment1.id, globalAttachment2.id],
      globalErrors: [globalError1, globalError2],
      qualityGateResults: [],
      indexAttachmentByTestResult: {},
      indexTestResultByHistoryId: {},
      indexTestResultByTestCase: {},
      indexLatestEnvTestResultByHistoryId: {},
      indexAttachmentByFixture: {},
      indexFixturesByTestResult: {},
      indexKnownByHistoryId: {},
    };

    const store = new DefaultAllureStore();

    await store.restoreState(dump as unknown as AllureStoreDump, {});

    const restoredGlobalAttachments = await store.allGlobalAttachments();
    const restoredGlobalErrors = await store.allGlobalErrors();
    const restoredQualityGateResults = await store.qualityGateResults();
    const testResults = await store.allTestResults();

    expect(restoredGlobalAttachments).toHaveLength(2);
    expect(restoredGlobalAttachments).toEqual([globalAttachment1, globalAttachment2]);
    expect(restoredGlobalErrors).toHaveLength(2);
    expect(restoredGlobalErrors).toEqual([globalError1, globalError2]);
    expect(restoredQualityGateResults).toEqual([]);
    expect(testResults).toHaveLength(1);
  });

  it("should append globalAttachments and globalErrors when restoring to existing store", async () => {
    const mockRealtimeSubscriber = {
      onQualityGateResults: vi.fn(),
      onGlobalExitCode: vi.fn(),
      onGlobalError: vi.fn(),
      onGlobalAttachment: vi.fn(),
    };
    const store = new DefaultAllureStore({
      realtimeSubscriber: mockRealtimeSubscriber as any,
    });
    const initialError = {
      message: "Initial error",
      trace: "Initial stack trace",
    };
    const mockInitialAttachmentFile = {
      getOriginalFileName: () => "initial.log",
      getExtension: () => ".log",
      getContentType: () => "text/plain",
      getContentLength: () => 50,
    };
    const onGlobalErrorCallback = mockRealtimeSubscriber.onGlobalError.mock.calls[0][0];
    const onGlobalAttachmentCallback = mockRealtimeSubscriber.onGlobalAttachment.mock.calls[0][0];

    await onGlobalErrorCallback(initialError);
    await onGlobalAttachmentCallback({ attachment: mockInitialAttachmentFile });

    const dumpAttachment = {
      id: "dump-attachment",
      originalFileName: "dump.log",
      contentType: "text/plain",
      ext: ".log",
      used: false,
      missed: false,
      contentLength: 75,
    };
    const dumpError = {
      message: "Dump error",
      trace: "Dump stack trace",
    };
    const dump = {
      testResults: {},
      attachments: {
        [dumpAttachment.id]: dumpAttachment,
      },
      testCases: {},
      fixtures: {},
      environments: ["default"],
      reportVariables: {},
      globalAttachmentIds: [dumpAttachment.id],
      globalErrors: [dumpError],
      qualityGateResults: [],
      indexAttachmentByTestResult: {},
      indexTestResultByHistoryId: {},
      indexTestResultByTestCase: {},
      indexLatestEnvTestResultByHistoryId: {},
      indexAttachmentByFixture: {},
      indexFixturesByTestResult: {},
      indexKnownByHistoryId: {},
    };

    await store.restoreState(dump as unknown as AllureStoreDump, {});

    const allGlobalAttachments = await store.allGlobalAttachments();
    const allGlobalErrors = await store.allGlobalErrors();

    expect(allGlobalAttachments).toHaveLength(2);
    expect(allGlobalAttachments.some((att) => att.name === "initial.log")).toBe(true);
    expect(allGlobalAttachments.some((att) => att.originalFileName === "dump.log")).toBe(true);
    expect(allGlobalErrors).toHaveLength(2);
    expect(allGlobalErrors).toContain(initialError);
    expect(allGlobalErrors).toContain(dumpError);
  });

  it("should handle restoreState with missing globalAttachments and globalErrors gracefully", async () => {
    const dump = {
      testResults: {
        "test-result-id": {
          id: "test-result-id",
          name: "test result 1",
          status: "passed",
        },
      },
      attachments: {},
      testCases: {},
      fixtures: {},
      indexAttachmentByTestResult: {},
      indexTestResultByHistoryId: {},
      environments: ["default"],
      reportVariables: {},
    };

    const store = new DefaultAllureStore();

    await store.restoreState(dump as unknown as AllureStoreDump, {});

    const restoredGlobalAttachments = await store.allGlobalAttachments();
    const restoredGlobalErrors = await store.allGlobalErrors();

    expect(restoredGlobalAttachments).toEqual([]);
    expect(restoredGlobalErrors).toEqual([]);

    const testResults = await store.allTestResults();

    expect(testResults).toHaveLength(1);
    expect(testResults[0].id).toBe("test-result-id");
  });

  it("should handle restoreState with missing index properties gracefully", async () => {
    const dump = {
      testResults: {
        "test-result-id": {
          id: "test-result-id",
          name: "test result 1",
          status: "passed",
          historyId: "history-1",
          testCase: { id: "test-case-1", name: "Test Case 1" },
          environment: "default",
        },
      },
      attachments: {},
      testCases: {},
      fixtures: {},
      globalAttachments: [],
      globalErrors: [],
      indexAttachmentByTestResult: {},
      indexTestResultByHistoryId: {},
      // Missing new index properties to test graceful handling
      environments: ["default"],
      reportVariables: {},
    };

    const store = new DefaultAllureStore();

    await store.restoreState(dump as unknown as AllureStoreDump, {});

    const testResults = await store.allTestResults();

    expect(testResults).toHaveLength(1);
    expect(testResults[0].id).toBe("test-result-id");

    const testResultsByTestCase = await store.testResultsByTcId("test-case-1");

    expect(testResultsByTestCase).toBeDefined();
  });

  it("should dump and restore index properties with actual data", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      status: "passed",
      testId: "test-id-1",
      historyId: "history-1",
    };

    await store.visitTestResult(tr1, { readerId });

    const dump = store.dumpState();

    expect(dump.indexAttachmentByTestResult).toBeDefined();
    expect(dump.indexTestResultByHistoryId).toBeDefined();
    expect(dump.indexTestResultByTestCase).toBeDefined();
    expect(dump.indexLatestEnvTestResultByHistoryId).toBeDefined();
    expect(dump.indexAttachmentByFixture).toBeDefined();
    expect(dump.indexFixturesByTestResult).toBeDefined();
    expect(dump.indexKnownByHistoryId).toBeDefined();

    const newStore = new DefaultAllureStore();

    await newStore.restoreState(dump, {});

    const allTestResults = await newStore.allTestResults();

    expect(allTestResults).toHaveLength(1);
  });

  it("should dump and restore qualityGateResults", async () => {
    const mockRealtimeSubscriber = {
      onQualityGateResults: vi.fn(),
      onGlobalExitCode: vi.fn(),
      onGlobalError: vi.fn(),
      onGlobalAttachment: vi.fn(),
    };
    const store = new DefaultAllureStore({
      realtimeSubscriber: mockRealtimeSubscriber as any,
    });
    const qualityGateResults = [
      {
        success: true,
        expected: 0,
        actual: 0,
        rule: "failed",
        message: "No failed tests",
        environment: "default",
      },
      {
        success: false,
        expected: 100,
        actual: 80,
        rule: "coverage",
        message: "Coverage is below threshold",
        environment: "staging",
      },
    ];

    const onQualityGateResultsCallback = mockRealtimeSubscriber.onQualityGateResults.mock.calls[0][0];

    await onQualityGateResultsCallback(qualityGateResults);

    const dump = store.dumpState();

    expect(dump.qualityGateResults).toEqual(qualityGateResults);

    const newStore = new DefaultAllureStore();

    await newStore.restoreState(dump, {});

    const restoredResults = await newStore.qualityGateResults();

    expect(restoredResults).toEqual(qualityGateResults);
  });

  it("should append qualityGateResults when restoring to existing store", async () => {
    const mockRealtimeSubscriber = {
      onQualityGateResults: vi.fn(),
      onGlobalExitCode: vi.fn(),
      onGlobalError: vi.fn(),
      onGlobalAttachment: vi.fn(),
    };
    const store = new DefaultAllureStore({
      realtimeSubscriber: mockRealtimeSubscriber as any,
    });
    const initialResult = {
      success: true,
      expected: 0,
      actual: 0,
      rule: "failed",
      message: "No failed tests",
    };
    const onQualityGateResultsCallback = mockRealtimeSubscriber.onQualityGateResults.mock.calls[0][0];

    await onQualityGateResultsCallback([initialResult]);

    const dumpResult = {
      success: false,
      expected: 100,
      actual: 80,
      rule: "coverage",
      message: "Coverage is below threshold",
    };
    const dump = {
      testResults: {},
      attachments: {},
      testCases: {},
      fixtures: {},
      environments: ["default"],
      reportVariables: {},
      globalAttachmentIds: [],
      globalErrors: [],
      qualityGateResults: [dumpResult],
      indexAttachmentByTestResult: {},
      indexTestResultByHistoryId: {},
      indexTestResultByTestCase: {},
      indexLatestEnvTestResultByHistoryId: {},
      indexAttachmentByFixture: {},
      indexFixturesByTestResult: {},
      indexKnownByHistoryId: {},
    };

    await store.restoreState(dump as unknown as AllureStoreDump, {});

    const results = await store.qualityGateResults();

    expect(results).toHaveLength(2);
    expect(results).toContainEqual(initialResult);
    expect(results).toContainEqual(dumpResult);
  });

  it("should merge two dumps with different envs", async () => {
    let ndumps = 1;

    const generateDump = async (env: string) => {
      const store = new DefaultAllureStore({ environment: env });
      const trs = [1, 2].flatMap((t) =>
        [1, 2].map(
          (a) =>
            ({
              name: `Env ${env}, test ${t}, attempt ${a}`,
              status: "passed",
              testId: `test-${t}`,
              historyId: `test-${t}`,
              start: ndumps * 1000 + t * 100 + a * 10,
            }) as RawTestResult,
        ),
      );
      for (const tr of trs) {
        await store.visitTestResult(tr, { readerId });
      }
      ndumps++;
      return store.dumpState();
    };

    const targetStore = new DefaultAllureStore();
    const dump1 = await generateDump("1");
    const dump2 = await generateDump("2");

    await targetStore.restoreState(dump1);
    await targetStore.restoreState(dump2);

    const allTrs = await targetStore.allTestResults();
    const env1Test1Id = allTrs.find(({ name }) => name === "Env 1, test 1, attempt 2")?.id;
    const env1Test2Id = allTrs.find(({ name }) => name === "Env 1, test 2, attempt 2")?.id;
    const env2Test1Id = allTrs.find(({ name }) => name === "Env 2, test 1, attempt 2")?.id;
    const env2Test2Id = allTrs.find(({ name }) => name === "Env 2, test 2, attempt 2")?.id;
    const env1Test1Retries = env1Test1Id ? await targetStore.retriesByTrId(env1Test1Id) : [];
    const env1Test2Retries = env1Test2Id ? await targetStore.retriesByTrId(env1Test2Id) : [];
    const env2Test1Retries = env2Test1Id ? await targetStore.retriesByTrId(env2Test1Id) : [];
    const env2Test2Retries = env2Test2Id ? await targetStore.retriesByTrId(env2Test2Id) : [];

    expect(allTrs.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "Env 1, test 1, attempt 2",
        "Env 1, test 2, attempt 2",
        "Env 2, test 1, attempt 2",
        "Env 2, test 2, attempt 2",
      ]),
    );
    expect(env1Test1Retries.map(({ name }) => name)).toEqual(["Env 2, test 1, attempt 1", "Env 1, test 1, attempt 1"]);
    expect(env1Test2Retries.map(({ name }) => name)).toEqual(["Env 2, test 2, attempt 1", "Env 1, test 2, attempt 1"]);
    expect(env2Test1Retries.map(({ name }) => name)).toEqual(["Env 2, test 1, attempt 1", "Env 1, test 1, attempt 1"]);
    expect(env2Test2Retries.map(({ name }) => name)).toEqual(["Env 2, test 2, attempt 1", "Env 1, test 2, attempt 1"]);
  });

  it("should merge two dumps with no envs", async () => {
    let ndumps = 1;

    const generateDump = async () => {
      const store = new DefaultAllureStore();
      const trs = [1, 2].flatMap((t) =>
        [1, 2].map(
          (a) =>
            ({
              name: `Dump ${ndumps}, test ${t}, attempt ${a}`,
              status: "passed",
              testId: `test-${t}`,
              historyId: `test-${t}`,
              start: ndumps * 1000 + t * 100 + a * 10,
            }) as RawTestResult,
        ),
      );
      for (const tr of trs) {
        await store.visitTestResult(tr, { readerId });
      }
      ndumps++;
      return store.dumpState();
    };

    const targetStore = new DefaultAllureStore();

    // dump 2 contains retries for the same set of tests
    const dump1 = await generateDump();
    const dump2 = await generateDump();

    await targetStore.restoreState(dump1);
    await targetStore.restoreState(dump2);

    const allTrs = await targetStore.allTestResults();
    const test1Id = allTrs.find(({ name }) => name === "Dump 2, test 1, attempt 2")?.id;
    const test2Id = allTrs.find(({ name }) => name === "Dump 2, test 2, attempt 2")?.id;
    const test1Retries = test1Id ? await targetStore.retriesByTrId(test1Id) : [];
    const test2Retries = test2Id ? await targetStore.retriesByTrId(test2Id) : [];

    expect(allTrs.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["Dump 2, test 1, attempt 2", "Dump 2, test 2, attempt 2"]),
    );
    expect(test1Retries.map(({ name }) => name)).toEqual([
      "Dump 2, test 1, attempt 1",
      "Dump 1, test 1, attempt 2",
      "Dump 1, test 1, attempt 1",
    ]);
    expect(test2Retries.map(({ name }) => name)).toEqual([
      "Dump 2, test 2, attempt 1",
      "Dump 1, test 2, attempt 2",
      "Dump 1, test 2, attempt 1",
    ]);
  });
});

describe("dictionary safety", () => {
  it("groups test results by prototype-like label values", async () => {
    const store = new DefaultAllureStore();

    await store.visitTestResult(
      {
        name: "proto test",
        labels: [{ name: "suite", value: "__proto__" }],
      },
      { readerId },
    );
    await store.visitTestResult(
      {
        name: "constructor test",
        labels: [{ name: "suite", value: "constructor" }],
      },
      { readerId },
    );
    await store.visitTestResult(
      {
        name: "toString test",
        labels: [{ name: "suite", value: "toString" }],
      },
      { readerId },
    );
    await store.visitTestResult(
      {
        name: "no suite label",
      },
      { readerId },
    );

    const byLabel = await store.testResultsByLabel("suite");

    expect(Object.getPrototypeOf(byLabel)).toBeNull();
    expect(byLabel.__proto__.map((tr) => tr.name)).toEqual(["proto test"]);
    expect(byLabel.constructor.map((tr) => tr.name)).toEqual(["constructor test"]);
    expect(byLabel.toString.map((tr) => tr.name)).toEqual(["toString test"]);
    expect(byLabel._.map((tr) => tr.name)).toEqual(["no suite label"]);
  });

  it("groups quality gate results by prototype-like environment names", async () => {
    const mockRealtimeSubscriber = {
      onQualityGateResults: vi.fn(),
      onGlobalExitCode: vi.fn(),
      onGlobalError: vi.fn(),
      onGlobalAttachment: vi.fn(),
    };
    const store = new DefaultAllureStore({
      realtimeSubscriber: mockRealtimeSubscriber as any,
    });
    const onQualityGateResultsCallback = mockRealtimeSubscriber.onQualityGateResults.mock.calls[0][0];

    await onQualityGateResultsCallback([
      {
        success: true,
        expected: 0,
        actual: 0,
        rule: "failed",
        message: "No failed tests",
        environment: "__proto__",
      },
      {
        success: false,
        expected: 0,
        actual: 1,
        rule: "failed",
        message: "Failed tests",
        environment: "constructor",
      },
      {
        success: false,
        expected: 0,
        actual: 1,
        rule: "failed",
        message: "Failed tests",
        environment: "toString",
      },
    ]);

    const byEnv = await store.qualityGateResultsByEnv();

    expect(Object.getPrototypeOf(byEnv)).toBeNull();
    expect(byEnv.__proto__).toHaveLength(1);
    expect(byEnv.constructor).toHaveLength(1);
    expect(byEnv.toString).toHaveLength(1);
  });
});

describe("updateMapWithRecord", () => {
  it("should update a map with a record", () => {
    const map = new Map<string, number>([
      ["a", 1],
      ["b", 2],
    ]);
    const record = { b: 3, c: 4 };
    const result = updateMapWithRecord(map, record);

    expect(result).toBe(map);
    expect(Array.from(result.entries())).toEqual([
      ["a", 1],
      ["b", 3],
      ["c", 4],
    ]);
  });

  it("should handle empty record and map", () => {
    const map = new Map();
    const record = {};
    const result = updateMapWithRecord(map, record);

    expect(result.size).toBe(0);
  });
});

describe("mapToObject", () => {
  it("should convert a map with string keys to an object", () => {
    const map = new Map<string, number>([
      ["a", 1],
      ["b", 2],
    ]);
    const obj = mapToObject(map);

    expect(obj).toEqual({ a: 1, b: 2 });
  });

  it("should convert a map with number keys to an object", () => {
    const map = new Map<number, string>([
      [1, "one"],
      [2, "two"],
    ]);
    const obj = mapToObject(map);

    expect(obj).toEqual({ 1: "one", 2: "two" });
  });

  it("should convert a map with symbol keys to an object", () => {
    const symA = Symbol("a");
    const symB = Symbol("b");
    const map = new Map<symbol, string>([
      [symA, "A"],
      [symB, "B"],
    ]);
    const obj = mapToObject(map);

    expect(obj[symA]).toBe("A");
    expect(obj[symB]).toBe("B");
  });

  it("should return an empty object for an empty map", () => {
    const map = new Map();
    const obj = mapToObject(map);

    expect(obj).toEqual({});
  });
});
