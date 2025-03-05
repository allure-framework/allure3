/* eslint-disable max-lines */
import type { HistoryDataPoint } from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import type { RawTestResult } from "@allurereport/reader-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { describe, expect, it } from "vitest";
import { DefaultAllureStore } from "../../src/store/store.js";

const readerId = "store.test.ts";

describe("test results", () => {
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
    await store.visitAttachmentFile(rf1, { readerId });
    await store.visitAttachmentFile(rf2, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });
    await store.visitAttachmentFile(rf2, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });
    await store.visitAttachmentFile(rf2, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });
    await store.visitAttachmentFile(rf2, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });

    const rf2 = new BufferResultFile(buffer1, "tr1-source1.txt");
    await store.visitAttachmentFile(rf2, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });

    const rf2 = new BufferResultFile(buffer1, "other.xml");
    await store.visitAttachmentFile(rf2, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });

    const rf2 = new BufferResultFile(buffer1, "other.xml");
    await store.visitAttachmentFile(rf2, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });
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
    await store.visitAttachmentFile(rf1, { readerId });
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
    await store.visitAttachmentFile(rf1, { readerId });
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
    await store.visitAttachmentFile(rf1, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });
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
    await store.visitAttachmentFile(rf1, { readerId });

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
    await store.visitAttachmentFile(rf1, { readerId });
    await store.visitTestResult(tr1, { readerId });

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1",
      ext: ".txt",
    });
  });

  it("should use extension based on detected content type if no extension and content type is provided (link first)", async () => {
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
    await store.visitAttachmentFile(rf1, { readerId });

    const [attachment] = await store.allAttachments();

    expect(attachment).toMatchObject({
      name: "attachment 1",
      originalFileName: "tr1-source1",
      contentType: "image/svg+xml",
      ext: ".svg",
    });
  });

  it("should use extension based on detected content type if no extension and content type is provided (file first)", async () => {
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
    await store.visitAttachmentFile(rf1, { readerId });
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
    const history: HistoryDataPoint[] = [
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
    ];
    const store = new DefaultAllureStore({
      history,
    });
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
    const store = new DefaultAllureStore({
      history,
    });
    const historyDataPoints = await store.allHistoryDataPoints();

    expect(historyDataPoints).toHaveLength(0);
  });

  it("should return empty history for test result if no history data is found", async () => {
    const history: HistoryDataPoint[] = [
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
    ];
    const store = new DefaultAllureStore({
      history,
    });

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
    const history: HistoryDataPoint[] = [
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
    ];
    const store = new DefaultAllureStore({
      history,
    });

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
    const history: HistoryDataPoint[] = [
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
    ];
    const store = new DefaultAllureStore({
      history,
    });

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
    const history: HistoryDataPoint[] = [
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
    ];
    const store = new DefaultAllureStore({
      history,
    });

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
  it("should return all environments with test results when they are specified", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: ({ labels }) => !!labels.find(({ name, value }) => name === "env" && value === "foo"),
        },
      },
    });
    const tr1: RawTestResult = {
      name: "test result 1",
      labels: [
        {
          name: "env",
          value: "foo",
        },
      ],
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      labels: [
        {
          name: "env",
          value: "bar",
        },
      ],
    };

    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const result = await store.allEnvironments();

    expect(result).toEqual({
      foo: {
        variables: {},
        testResults: [
          expect.objectContaining({
            name: tr1.name,
          }),
        ],
      },
      default: {
        variables: {},
        testResults: [
          expect.objectContaining({
            name: tr2.name,
          }),
        ],
      },
    });
  });

  it("should return an array with default environment object when no environments are specified", async () => {
    const store = new DefaultAllureStore();
    const tr1: RawTestResult = {
      name: "test result 1",
      labels: [
        {
          name: "env",
          value: "foo",
        },
      ],
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      labels: [
        {
          name: "env",
          value: "bar",
        },
      ],
    };

    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const result = await store.allEnvironments();

    expect(result).toEqual({
      default: {
        variables: {},
        testResults: [
          expect.objectContaining({
            name: tr1.name,
          }),
          expect.objectContaining({
            name: tr2.name,
          }),
        ],
      },
    });
  });

  it("should return an environment by it's id", async () => {
    const store = new DefaultAllureStore({
      environmentsConfig: {
        foo: {
          matcher: ({ labels }) => !!labels.find(({ name, value }) => name === "env" && value === "foo"),
        },
      },
    });
    const tr1: RawTestResult = {
      name: "test result 1",
      labels: [
        {
          name: "env",
          value: "foo",
        },
      ],
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      labels: [
        {
          name: "env",
          value: "bar",
        },
      ],
    };

    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    expect(await store.environmentById("foo")).toEqual({
      variables: {},
      testResults: [
        expect.objectContaining({
          name: tr1.name,
        }),
      ],
    });
    expect(await store.environmentById("default")).toEqual({
      variables: {},
      testResults: [
        expect.objectContaining({
          name: tr2.name,
        }),
      ],
    });
  });

  it("should return undefined when an environment with the specified id is not found", async () => {
    const store = new DefaultAllureStore();
    const result = await store.environmentById("foo");

    expect(result).toBeUndefined();
  });

  it("adds report-wide variables to each environment", async () => {
    const store = new DefaultAllureStore({
      reportVariables: {
        hello: "earth",
        goodbye: "moon",
      },
      environmentsConfig: {
        foo: {
          matcher: ({ labels }) => !!labels.find(({ name, value }) => name === "env" && value === "foo"),
          variables: {
            hello: "mars",
          },
        },
      },
    });
    const tr1: RawTestResult = {
      name: "test result 1",
      labels: [
        {
          name: "env",
          value: "foo",
        },
      ],
    };
    const tr2: RawTestResult = {
      name: "test result 2",
      labels: [
        {
          name: "env",
          value: "bar",
        },
      ],
    };

    await store.visitTestResult(tr1, { readerId });
    await store.visitTestResult(tr2, { readerId });

    const result = await store.allEnvironments();

    expect(result).toEqual({
      foo: {
        variables: {
          hello: "mars",
          goodbye: "moon",
        },
        testResults: [
          expect.objectContaining({
            name: tr1.name,
          }),
        ],
      },
      default: {
        variables: {
          hello: "earth",
          goodbye: "moon",
        },
        testResults: [
          expect.objectContaining({
            name: tr2.name,
          }),
        ],
      },
    });
  });
});
