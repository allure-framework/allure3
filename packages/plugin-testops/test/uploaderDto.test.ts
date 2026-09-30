import { describe, expect, it } from "vitest";

import { getAttachmentIdsFromTestStepsResults } from "../src/utils/attachments.js";
import { toUploadFixtureResultDto } from "../src/utils/fixtures.js";
import { normalizeTestStepsResults, toUploadTestResultDto } from "../src/utils/testResults.js";

describe("uploader DTO executable names", () => {
  it("maps projected nested step trees while preserving attachments", () => {
    const steps = normalizeTestStepsResults([
      {
        type: "step",
        name: "parent",
        status: "passed",
        start: 1,
        steps: [{ type: "step", name: "bad\u0000name", status: "failed", steps: [] }],
      },
      { type: "attachment", link: { id: "attachment", name: "bad\u0000name" } },
    ] as any);
    const result = toUploadTestResultDto({
      id: "result",
      name: "Result",
      status: "passed",
      steps,
    } as any);
    const fixture = toUploadFixtureResultDto({
      type: "BEFORE",
      id: "fixture",
      name: "Fixture",
      status: "broken",
      steps: [],
    } as any);

    expect(result.name).toBe("Result");
    expect(result.steps).toEqual([
      expect.objectContaining({
        body: "parent",
        status: "passed",
        start: 1,
        steps: [],
      }),
      { type: "attachment", attachment: { name: "bad\u0000name" } },
    ]);
    expect(fixture).toEqual(expect.objectContaining({ status: "broken", name: "Fixture" }));
  });

  it("preserves valid Unicode names", () => {
    const name = "日本語 ✅ 𐀀";

    expect(toUploadTestResultDto({ id: "result", name } as any).name).toBe(name);
    expect(toUploadFixtureResultDto({ type: "AFTER", id: "fixture", name } as any).name).toBe(name);
  });

  it("preserves whitespace around valid names", () => {
    const name = "  valid name  ";

    expect(toUploadTestResultDto({ id: "result", name } as any).name).toBe(name);
    expect(toUploadFixtureResultDto({ type: "AFTER", id: "fixture", name } as any).name).toBe(name);
  });

  it("uploads the legacy history ID instead of canonical retryHash", () => {
    const result = toUploadTestResultDto({
      id: "result",
      name: "Result",
      retryHash: "canonical.retry.hash",
      testCase: { allureId: "123" },
      parameters: [],
      sourceMetadata: { legacyTestCaseHash: "361dc45aacd2d2a1961554d12a2d666b" },
    } as any);

    expect(result.historyId).toBe("361dc45aacd2d2a1961554d12a2d666b.d41d8cd98f00b204e9800998ecf8427e");
    expect(result).not.toHaveProperty("retryHash");
  });

  it("preserves a restored top-level legacy history ID", () => {
    const result = toUploadTestResultDto({
      id: "result",
      name: "Result",
      historyId: "existing-legacy-history-id",
      sourceMetadata: { legacyTestCaseHash: "ignored-test-case-hash" },
      parameters: [],
    } as any);

    expect(result.historyId).toBe("existing-legacy-history-id");
  });

  it("projects invalid step subtrees and keeps attachment allowlist", () => {
    const steps = [
      {
        type: "step",
        name: "invalid\u0000step",
        steps: [{ type: "attachment", link: { id: "removed" } }],
      },
      { type: "attachment", link: { id: "kept" } },
    ] as any;

    const projected = normalizeTestStepsResults(steps)!;

    expect(projected).toEqual([{ type: "attachment", link: { id: "kept" } }]);
    expect(getAttachmentIdsFromTestStepsResults(projected)).toEqual(new Set(["kept"]));
  });
});
