import { describe, it, expect } from "vitest";
import { timestampToDate } from "./time";

describe("timestampToDate", () => {
  it("should return undefined for undefined input", () => {
    const result = timestampToDate(undefined);
    expect(result).toBeUndefined();
  });

  it("should return undefined for null input", () => {
    const result = timestampToDate(null as any);
    expect(result).toBeUndefined();
  });

  it("should format valid timestamp correctly", () => {
    const timestamp = 1640995200000; // 2022-01-01 00:00:00 UTC
    const result = timestampToDate(timestamp);
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    expect(result).toContain("1/1/2022");
  });

  it("should handle zero timestamp", () => {
    const result = timestampToDate(0);
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });
}); 