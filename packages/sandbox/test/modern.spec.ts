import { expect, it } from "vitest";

it("sample passed test", async () => {
  expect(true).toBe(true);
});

it("sample failed test", async () => {
  expect(true).toBe(false);
});

it("sample broken test", async () => {
  throw new Error("broken test's reason");
});

it("sample skipped test", async (ctx) => {
  ctx.skip();
});
