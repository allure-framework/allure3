import { it } from "vite-plus/test";

it("sample issue resolution", () => {
  throw new Error("test issue");
});

it("sample accepted resolution", () => {
  throw new Error("test accepted");
});

it("sample muted resolution", () => {
  throw new Error("test muted");
});
