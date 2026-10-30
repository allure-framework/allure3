import { ExpressionError } from "@allurereport/core-api";
import { expect, it, vi } from "vite-plus/test";

import { readXcResultBundle } from "../src/xcresult/index.js";
import { version } from "../src/xcresult/xcresulttool/cli.js";
import { mockVisitor } from "./utils.js";

vi.mock("../src/xcresult/bundle.js", () => ({
  IS_MAC: true,
  isXcResultBundle: async () => true,
}));
vi.mock("../src/xcresult/xcresulttool/cli.js", () => ({ version: vi.fn() }));
vi.mock("../src/xcresult/xcresulttool/legacy/index.js", () => ({
  default: class {
    legacyApiSucceeded = () => false;
    async *parse() {
      yield { name: "test", status: "passed" };
    }
  },
}));
vi.mock("../src/xcresult/xcresulttool/utils.js", () => ({
  parseWithExportedAttachments: async (_path: string, parse: () => Promise<void>) => parse(),
}));

it.each(["22000", "23000"])("propagates async expression errors with xcresulttool %s", async (toolVersion) => {
  vi.mocked(version).mockResolvedValue(`xcresulttool version ${toolVersion}`);
  const visitor = mockVisitor();
  const error = new ExpressionError('Invalid expression at environments["firefox"].matcher');
  visitor.visitTestResult.mockRejectedValue(error);

  await expect(readXcResultBundle(visitor, "results.xcresult")).rejects.toBe(error);
});

it("keeps non-expression visitor failures recoverable", async () => {
  vi.mocked(version).mockResolvedValue("xcresulttool version 22000");
  const visitor = mockVisitor();
  visitor.visitTestResult.mockRejectedValue(new Error("invalid result"));

  await expect(readXcResultBundle(visitor, "results.xcresult")).resolves.toBe(false);
});
