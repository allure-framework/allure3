import { describe, expect, it } from "vitest";
import { formatDuration } from "../../src/index.js";

const randomInt = (max: number = 1000, min: number = 0): number => {
  return Math.floor(Math.random() * (max - min)) + min;
};

describe("formatDuration", () => {
  it("should return unknown for undefined", () => {
    const formatted = formatDuration(undefined);

    expect(formatted).toEqual("unknown");
  });
  it("should return 0s for negative numbers", () => {
    const duration = randomInt();
    const formatted = formatDuration(-duration);

    expect(formatted).toEqual("0s");
  });

  it("should return 0s for super low durations", () => {
    const duration = randomInt(999);
    const formatted = formatDuration(duration / 2000);

    expect(formatted).toEqual("0s");
  });

  it("should format ms only if less then a second", () => {
    const duration = randomInt(999, 1);
    const formatted = formatDuration(duration);

    expect(formatted).toEqual(`${duration}ms`);
  });

  it("should format days and hours", () => {
    const days = randomInt(100, 1);
    const hours = randomInt(23, 1);
    const formatted = formatDuration(days * 24 * 3600 * 1000 + hours * 3600 * 1000 + randomInt(59) * 60 * 1000);

    expect(formatted).toEqual(`${days}d ${hours}h`);
  });

  it("should format hours and minutes", () => {
    const hours = randomInt(23, 1);
    const minutes = randomInt(59, 1);
    const formatted = formatDuration(
      hours * 3600 * 1000 + minutes * 60 * 1000 + randomInt(59) * 1000 + randomInt(1000),
    );

    expect(formatted).toEqual(`${hours}h ${minutes}m`);
  });

  it("should format minutes and seconds", () => {
    const minutes = randomInt(59, 1);
    const seconds = randomInt(59, 1);
    const formatted = formatDuration(minutes * 60 * 1000 + seconds * 1000 + randomInt(1000));

    expect(formatted).toEqual(`${minutes}m ${seconds}s`);
  });

  it("should format seconds and milliseconds", () => {
    const minutes = randomInt(59, 1);
    const seconds = randomInt(59, 1);
    const formatted = formatDuration(minutes * 60 * 1000 + seconds * 1000 + randomInt(1000));

    expect(formatted).toEqual(`${minutes}m ${seconds}s`);
  });

  it("should show 0h with days instead of milliseconds", () => {
    const days = randomInt(100, 1);
    const formatted = formatDuration(days * 24 * 3600 * 1000 + randomInt(1000));

    expect(formatted).toEqual(`${days}d 0h`);
  });

  it("should show 0h with days instead of seconds", () => {
    const days = randomInt(100, 1);
    const seconds = randomInt(59, 1);
    const formatted = formatDuration(days * 24 * 3600 * 1000 + seconds * 1000 + randomInt(1000));

    expect(formatted).toEqual(`${days}d 0h`);
  });

  it("should show 0h if exact days", () => {
    const days = randomInt(100, 1);
    const formatted = formatDuration(days * 24 * 3600 * 1000);

    expect(formatted).toEqual(`${days}d 0h`);
  });
});
