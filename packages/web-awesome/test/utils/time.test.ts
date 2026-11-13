import { describe, expect, it, vi } from "vite-plus/test";

import { formatTimeRange, preciseDateTimeOptions, timestampToDate } from "@/utils/time";

const numericDateTimeOptions: Intl.DateTimeFormatOptions = {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
};

vi.mock("@/stores/locale", () => ({
  currentLocale: { value: "en" },
  currentLocaleIso: { value: "en-US" },
  useI18n: () => ({
    t: (key: string) => (key === "at" ? "at" : key),
  }),
}));

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getLocaleDateTimeOverride: () => undefined,
}));

describe("utils > timestampToDate", () => {
  it("should keep Intl-provided at separator for long English dates", () => {
    const timestamp = 1527776360360;
    const options: Intl.DateTimeFormatOptions = {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    };
    const intlFormatted = new Intl.DateTimeFormat("en-US", options).format(new Date(timestamp));
    const formatted = timestampToDate(timestamp, options);

    expect(formatted).toBe(intlFormatted);
    expect(formatted).not.toContain("May 31 at 2018 at");
  });

  it("should add at separator when Intl returns comma-separated date and time", () => {
    const timestamp = 1779887536194;
    const intlFormatted = new Intl.DateTimeFormat("en-US", numericDateTimeOptions).format(new Date(timestamp));

    expect(timestampToDate(timestamp, numericDateTimeOptions)).toBe(intlFormatted.replace(",", " at"));
  });
});

describe("utils > formatTimeRange", () => {
  const start = 1779887536194;
  const stop = 1779887537802;
  const format = (timestamp: number) =>
    new Intl.DateTimeFormat("en-US", preciseDateTimeOptions).format(new Date(timestamp)).replace(",", " at");

  it("should label the start and the stop, one per line", () => {
    expect(formatTimeRange(start, stop)).toBe(`start: ${format(start)}\nstop: ${format(stop)}`);
  });

  it("should keep milliseconds so that steps starting within the same second can be told apart", () => {
    const [first, second] = (formatTimeRange(start, start + 1) as string).split("\n");

    expect(first).toContain(".194");
    expect(second).toContain(".195");
  });

  it("should order the lines by time and keep every label with its own timestamp", () => {
    // clock skew between machines can produce a stop that is earlier than the start
    const later = start + 1000;
    const [first, second] = (formatTimeRange(later, start) as string).split("\n");

    expect(first).toBe(`stop: ${format(start)}`);
    expect(second).toBe(`start: ${format(later)}`);
  });

  it("should fall back to the single known timestamp, keeping its label", () => {
    expect(formatTimeRange(undefined, stop)).toBe(`stop: ${format(stop)}`);
    expect(formatTimeRange(start, undefined)).toBe(`start: ${format(start)}`);
  });

  it("should return undefined when neither timestamp is known", () => {
    expect(formatTimeRange()).toBeUndefined();
    expect(formatTimeRange(undefined, undefined)).toBeUndefined();
  });
});
