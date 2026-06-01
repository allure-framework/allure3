import { describe, expect, it, vi } from "vitest";

import { timestampToDate } from "@/utils/time";

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
