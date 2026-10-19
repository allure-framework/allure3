import { it } from "vite-plus/test";

it("sample actual mute", () => {
  throw new Error("actual issue");
});

it("sample mute with no expiration", () => {
  throw new Error("an issue with no expiration");
});

it("sample expired mute", () => {
  throw new Error("expired issue");
});
