import { expect, it } from "vitest";
import { label } from "allure-js-commons";

it("sample passed test", async () => {
  await label("env", "foo");
  expect(true).toBe(true);
});

it("sample failed test", async () => {
  await label("env", "bar");
  expect(true).toBe(false);
});

it("sample broken test", async () => {
  throw new Error("broken test's reason");
});

it("sample skipped test", async (ctx) => {
  ctx.skip();
});
