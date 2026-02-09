import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allure2 } from "../src/index.js";
import { readResults } from "./utils.js";

const generateTestResultName = () => `${randomUUID()}-result.json`;
const generateGlobalsName = () => `${randomUUID()}-globals.json`;

describe("allure2 reader", () => {
  it("should parse simple result", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/simple.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "Passed test",
      status: "passed",
      fullName: "Simple Tests > Passed test",
      start: 1566219149481,
      stop: 1566219149485,
    });
  });

  it("should parse fullName", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/fullName.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "Full Name test",
      fullName: "Units > Some test full name",
    });
  });

  it("should parse description", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/description.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "Description test",
      description: "some test description",
    });
  });

  it("should parse description html", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/description-html.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "Description HTML test",
      descriptionHtml: "some test HTML description",
    });
  });

  it("should parse start", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/timings-start.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "Start test",
      start: 1566219149481,
    });
  });

  it("should parse stop", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/timings-stop.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "Stop test",
      stop: 1566219149481,
    });
  });

  it("should parse historyId", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/historyId.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "HistoryId test",
      historyId: "some-history-id",
    });
  });

  it("should parse testId", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/testCaseId.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "TestCaseId test",
      testId: "some-test-case-id",
    });
  });

  it("should parse uuid", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/uuid.json": generateTestResultName(),
    });
    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    expect(visitor.visitTestResult.mock.calls[0][0]).toMatchObject({
      name: "UUID test",
      uuid: "some-id",
    });
  });

  it("should parse labels", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/labels.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];
    expect(tr).toMatchObject({
      labels: expect.arrayContaining([
        {
          name: "first",
          value: "first value",
        },
        {
          name: "second",
          value: "second value",
        },
        {
          name: "duplicate",
          value: "duplicate value",
        },
        {
          name: "without value",
        },
        {
          value: "only value",
        },
      ]),
    });
  });

  it("should parse links", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/links.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];
    expect(tr).toMatchObject({
      links: expect.arrayContaining([
        {
          name: "Default link",
          url: "https://example.org/",
        },
        {
          url: "https://example.org/without-name",
        },
        {
          type: "issue",
          name: "Issue link",
          url: "https://example.org/issue",
        },
        {
          type: "tms",
          name: "Tms link",
          url: "https://example.org/tms",
        },
        {
          type: "custom",
          name: "Custom link",
          url: "https://example.org/custom",
        },
        {
          name: "https://example.org/name-as-url",
        },
      ]),
    });
  });

  it("should parse parameters", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/parameters.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      parameters: expect.arrayContaining([
        {
          name: "param 1",
          value: "value 1",
          hidden: true,
          masked: false,
          excluded: true,
        },
        {
          name: "param 2",
          value: "value 2",
          hidden: true,
          masked: false,
          excluded: false,
        },
        {
          name: "param 3",
          value: "value 3",
          hidden: false,
          masked: false,
        },
        {
          name: "param 4",
          value: "value 4",
          hidden: true,
          masked: false,
        },
        {
          name: "param 5",
          value: "value 5",
          hidden: false,
          masked: false,
          excluded: true,
        },
        {
          name: "param 6",
          value: "value 6",
          hidden: false,
          masked: false,
        },
        {
          name: "param 7",
          value: "value 7",
          hidden: false,
          masked: true,
        },
      ]),
    });
  });

  it("should parse steps", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/steps.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: "Step 1",
          status: "passed",
        }),
        expect.objectContaining({
          name: "Step 2",
          status: "passed",
          steps: expect.arrayContaining([
            expect.objectContaining({
              name: "Step 2.1",
              status: "passed",
            }),
            expect.objectContaining({
              name: "Step 2.2",
              status: "passed",
              steps: expect.arrayContaining([
                expect.objectContaining({
                  name: "Step 2.2.1",
                  status: "passed",
                }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          name: "Step 3",
          status: "passed",
        }),
      ]),
    });
  });

  it("should parse step statuses", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/steps-status.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: "Step 1",
          status: "failed",
        }),
        expect.objectContaining({
          name: "Step 2",
          status: "broken",
          steps: expect.arrayContaining([
            expect.objectContaining({
              name: "Step 2.1",
              status: "passed",
            }),
            expect.objectContaining({
              name: "Step 2.2",
              status: "skipped",
              steps: expect.arrayContaining([
                expect.objectContaining({
                  name: "Step 2.2.1",
                  status: "skipped",
                }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          name: "Step 3",
          status: "unknown",
        }),
      ]),
    });
  });

  it("should parse step status details", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/steps-status-details.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: "Step 1",
          status: "failed",
        }),
        expect.objectContaining({
          name: "Step 2",
          status: "broken",
          message: "some message",
          steps: expect.arrayContaining([
            expect.objectContaining({
              name: "Step 2.1",
              status: "passed",
            }),
            expect.objectContaining({
              name: "Step 2.2",
              status: "skipped",
              steps: expect.arrayContaining([
                expect.objectContaining({
                  name: "Step 2.2.1",
                  status: "skipped",
                  trace: "some trace",
                }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          name: "Step 3",
          status: "unknown",
          message: "other message",
          trace: "other trace",
        }),
      ]),
    });
  });

  it("should parse step timings", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/steps-timings.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: "Step 1",
          start: 1566219149481,
          stop: 1566219149485,
        }),
        expect.objectContaining({
          name: "Step 2",
          start: 1566219249481,
          stop: 1566219169485,
        }),
        expect.objectContaining({
          name: "Step 3",
          start: 1566218149481,
          stop: 1566219249485,
        }),
      ]),
    });
  });

  it("should parse step parameters", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/steps-parameters.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: "Some step with parameters",
          parameters: expect.arrayContaining([
            {
              name: "param 1",
              value: "value 1",
              hidden: true,
              masked: false,
              excluded: true,
            },
            {
              name: "param 2",
              value: "value 2",
              hidden: true,
              masked: false,
              excluded: false,
            },
            {
              name: "param 3",
              value: "value 3",
              hidden: false,
              masked: false,
            },
            {
              name: "param 4",
              value: "value 4",
              hidden: true,
              masked: false,
            },
            {
              name: "param 5",
              value: "value 5",
              hidden: false,
              masked: false,
              excluded: true,
            },
            {
              name: "param 6",
              value: "value 6",
              hidden: false,
              masked: false,
            },
            {
              name: "param 7",
              value: "value 7",
              hidden: false,
              masked: true,
            },
          ]),
        }),
      ]),
    });
  });

  it("should parse step attachments", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/steps-attachments.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: "Step 1",
          status: "passed",
          steps: expect.arrayContaining([
            expect.objectContaining({
              name: "some name",
              originalFileName: "some-source.ext",
              contentType: "some/type",
              type: "attachment",
            }),
          ]),
        }),
        expect.objectContaining({
          name: "Step 2",
          status: "passed",
          steps: expect.arrayContaining([
            expect.objectContaining({
              name: "Step 2.1",
              status: "passed",
              steps: expect.arrayContaining([
                expect.objectContaining({
                  originalFileName: "some-source-without-name.ext",
                  contentType: "some/type",
                  type: "attachment",
                }),
                expect.objectContaining({
                  name: "without type",
                  originalFileName: "some-source-without-type.ext",
                  type: "attachment",
                }),
                expect.objectContaining({
                  originalFileName: "some-source-only.ext",
                  type: "attachment",
                }),
              ]),
            }),
            expect.objectContaining({
              name: "Step 2.2",
              status: "passed",
              steps: expect.arrayContaining([
                expect.objectContaining({
                  name: "Step 2.2.1",
                  status: "passed",
                }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          name: "Step 3",
          status: "passed",
        }),
      ]),
    });
  });

  it("should parse attachments", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/attachments.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: "some name",
          originalFileName: "some-source.ext",
          contentType: "some/type",
          type: "attachment",
        }),
        expect.objectContaining({
          originalFileName: "some-source-without-name.ext",
          contentType: "some/type",
          type: "attachment",
        }),
        expect.objectContaining({
          name: "without type",
          originalFileName: "some-source-without-type.ext",
          type: "attachment",
        }),
        expect.objectContaining({
          originalFileName: "some-source-only.ext",
          type: "attachment",
        }),
      ]),
    });
  });

  it("should parse null status", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-null.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      status: "unknown",
    });
  });

  it("should parse empty status", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-not-set.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      status: "unknown",
    });
  });

  it("should parse invalid status", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-invalid.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      status: "unknown",
    });
  });

  it("should parse status case insensitive", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-case-insensitive.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      status: "passed",
    });
  });

  it("should parse message", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-details-message.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      message: "some message",
    });
  });

  it("should parse trace", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-details-trace.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      trace: "some trace",
    });
  });

  it("should parse actual", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-details-actual.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      actual: "some actual",
    });
  });

  it("should parse expected", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-details-expected.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const tr = visitor.visitTestResult.mock.calls[0][0];

    expect(tr).toMatchObject({
      expected: "some expected",
    });
  });

  it("should parse flaky status detail", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/status-details-flaky.json": generateTestResultName(),
      "allure2data/status-details-flaky-false.json": generateTestResultName(),
      "allure2data/status-details-flaky-not-set.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(3);

    const tr1 = visitor.visitTestResult.mock.calls[0][0];
    const tr2 = visitor.visitTestResult.mock.calls[1][0];
    const tr3 = visitor.visitTestResult.mock.calls[2][0];

    expect(tr1).toMatchObject({
      name: "flaky test",
      flaky: true,
    });

    expect(tr2).toMatchObject({
      name: "not flaky test",
      flaky: false,
    });

    expect(tr3).toMatchObject({
      name: "default not flaky test",
    });
  });

  it("should specify correct readerId", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/simple.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(1);
    const { readerId } = visitor.visitTestResult.mock.calls[0][1];

    expect(readerId).eq("allure2");
  });

  it("should ignore invalid json", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/invalid.json": generateTestResultName(),
    });

    expect(visitor.visitTestResult).toHaveBeenCalledTimes(0);
  });

  it("should add attachments with extension", async () => {
    const fileName = `${randomUUID()}-attachment.json`;
    const visitor = await readResults(allure2, {
      "allure2data/simple.json": fileName,
    });

    expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
    const [file, { readerId }] = visitor.visitAttachmentFile.mock.calls[0];
    expect(readerId).eq("allure2");
    expect(file.getOriginalFileName()).eq(fileName);
    expect(await file.asUtf8String()).toMatchInlineSnapshot(`"{
  "name": "Passed test",
  "fullName": "Simple Tests > Passed test",
  "status": "passed",
  "start": 1566219149481,
  "stop": 1566219149485
}
"
`);
  });

  it("should add attachments without extension", async () => {
    const fileName = `${randomUUID()}-attachment`;
    const visitor = await readResults(allure2, {
      "allure2data/simple.json": fileName,
    });

    expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
    const [file, { readerId }] = visitor.visitAttachmentFile.mock.calls[0];
    expect(readerId).eq("allure2");
    expect(file.getOriginalFileName()).eq(fileName);
    expect(await file.asUtf8String()).toMatchInlineSnapshot(`"{
  "name": "Passed test",
  "fullName": "Simple Tests > Passed test",
  "status": "passed",
  "start": 1566219149481,
  "stop": 1566219149485
}
"
`);
  });

  it("should add attachments with complex extension", async () => {
    const fileName = `${randomUUID()}-attachment.tar.gz`;
    const visitor = await readResults(allure2, {
      "allure2data/simple.json": fileName,
    });

    expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
    const [file, { readerId }] = visitor.visitAttachmentFile.mock.calls[0];
    expect(readerId).eq("allure2");
    expect(file.getOriginalFileName()).eq(fileName);
    expect(await file.asUtf8String()).toMatchInlineSnapshot(`"{
  "name": "Passed test",
  "fullName": "Simple Tests > Passed test",
  "status": "passed",
  "start": 1566219149481,
  "stop": 1566219149485
}
"
`);
  });

  it("should parse environment.properties", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/allure2-env.properties": "environment.properties",
    });

    expect(visitor.visitMetadata).toHaveBeenCalledTimes(1);

    const metadata = visitor.visitMetadata.mock.calls[0][0];

    expect(metadata).toEqual({
      allure_environment: expect.arrayContaining([
        {
          name: "browser",
          values: ["chrome"],
        },
        {
          name: "url",
          values: ["https://allurereport.org/"],
        },
      ]),
    });
  });

  it("should parse environment.xml", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/allure2-env.xml": "environment.xml",
    });

    expect(visitor.visitMetadata).toHaveBeenCalledTimes(1);

    const metadata = visitor.visitMetadata.mock.calls[0][0];

    expect(metadata).toEqual({
      allure_environment: expect.arrayContaining([
        {
          name: "browser",
          values: ["chrome"],
        },
        {
          name: "host",
          values: ["https://allurereport.org"],
        },
        {
          name: "os.name",
          values: ["linux"],
        },
      ]),
    });
  });

  it("should parse globals with errors", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/globals-with-errors.json": generateGlobalsName(),
    });

    expect(visitor.visitGlobals).toHaveBeenCalledTimes(1);

    const [globals] = visitor.visitGlobals.mock.calls[0];

    expect(globals.errors).toHaveLength(2);
    expect(globals.errors).toEqual([
      {
        message: "Global setup failed",
        trace: "Error: Global setup failed\n    at setup.js:10:5",
      },
      {
        message: "Teardown error",
      },
    ]);
    expect(globals.attachments).toHaveLength(0);
  });

  it("should parse globals with attachments", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/globals-with-attachments.json": generateGlobalsName(),
    });

    expect(visitor.visitGlobals).toHaveBeenCalledTimes(1);

    const [globals] = visitor.visitGlobals.mock.calls[0];

    expect(globals.attachments).toHaveLength(2);
    expect(globals.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Global log",
          contentType: "text/plain",
          originalFileName: "global-log.txt",
          type: "attachment",
        }),
        expect.objectContaining({
          name: "Global screenshot",
          contentType: "image/png",
          originalFileName: "global-screenshot.png",
          type: "attachment",
        }),
      ]),
    );
    expect(globals.errors).toHaveLength(0);
  });

  it("should parse globals with both errors and attachments", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/globals-full.json": generateGlobalsName(),
    });

    expect(visitor.visitGlobals).toHaveBeenCalledTimes(1);

    const [globals] = visitor.visitGlobals.mock.calls[0];

    expect(globals.attachments).toHaveLength(1);
    expect(globals.attachments[0]).toMatchObject({
      name: "Setup log",
      contentType: "text/plain",
      originalFileName: "setup-log.txt",
      type: "attachment",
    });
    expect(globals.errors).toHaveLength(1);
    expect(globals.errors[0]).toEqual({
      message: "Configuration warning",
      trace: "Warning at config.js:42",
    });
  });

  it("should parse empty globals", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/globals-empty.json": generateGlobalsName(),
    });

    expect(visitor.visitGlobals).toHaveBeenCalledTimes(1);

    const [globals] = visitor.visitGlobals.mock.calls[0];

    expect(globals.attachments).toHaveLength(0);
    expect(globals.errors).toHaveLength(0);
  });

  it("should not call visitGlobals for non-globals json files", async () => {
    const visitor = await readResults(allure2, {
      "allure2data/simple.json": generateTestResultName(),
    });

    expect(visitor.visitGlobals).not.toHaveBeenCalled();
  });
});
