import { it, expect } from "vitest";

it("always pass 1", () => {
  expect(1).toBe(1);
});

it("always pass 2", () => {
  expect(1).toBe(1);
});

it("always pass 3", () => {
  expect(1).toBe(1);
});

it("sample check 1", async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();

      expect(Math.random()).toBeGreaterThan(0.8);
    }, 1000);
  });
});

it("sample check 2", async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();

      expect(Math.random()).toBeGreaterThan(0.8);
    }, 3000);
  });
});

it("sample check 3", async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();

      expect(Math.random()).toBeGreaterThan(0.8);
    }, 5000);
  });
});
