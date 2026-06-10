import { expect, it } from "vitest";

it("sample probably failed test", async () => {
  expect(Math.round(Math.random() * (5 - 1) + 1)).toBe(5);
});
