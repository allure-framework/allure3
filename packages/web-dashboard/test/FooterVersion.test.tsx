// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { FooterVersion } from "@/components/Footer/FooterVersion";
import { setLocale, waitForI18next } from "@/stores/locale";

const state = vi.hoisted(() => ({ options: {} as { createdAt?: number; allureVersion?: string } }));

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: () => state.options,
}));

beforeEach(async () => {
  await waitForI18next;
  await setLocale("en");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Dashboard footer generation date", () => {
  it.each([0, Date.UTC(2026, 0, 1), Date.UTC(2026, 6, 1)])(
    "renders the saved generation time, timezone and version: %s",
    (createdAt) => {
      state.options = { createdAt, allureVersion: "3.21.0" };
      const { container } = render(<FooterVersion />);
      expect(container.textContent).toContain(String(new Date(createdAt).getFullYear()));
      const timezone = new Intl.DateTimeFormat("en-US", { timeZoneName: "longOffset" })
        .formatToParts(new Date(createdAt))
        .find(({ type }) => type === "timeZoneName")?.value;
      expect(container.querySelector("bdi")?.textContent).toContain(timezone);
      expect(container.textContent).toContain("Ver: 3.21.0");
    },
  );

  it.each([undefined, NaN, Infinity, 9e20])("keeps the version without displaying an invalid date: %s", (createdAt) => {
    state.options = { createdAt, allureVersion: "3.21.0" };
    const { container } = render(<FooterVersion />);
    expect(container.textContent?.trim()).toBe("Ver: 3.21.0");
    expect(container.querySelector("bdi")).toBeNull();
  });

  it("updates the localized date through the Dashboard locale store", async () => {
    state.options = { createdAt: Date.UTC(2026, 9, 20, 12, 34, 56), allureVersion: "3.21.0" };
    const { container } = render(<FooterVersion />);
    const before = container.textContent;
    const offset = new Intl.DateTimeFormat("en-US", { timeZoneName: "longOffset" })
      .formatToParts(state.options.createdAt)
      .find(({ type }) => type === "timeZoneName")?.value;
    await act(async () => {
      await setLocale("de");
    });
    expect(container.textContent).not.toBe(before);
    expect(container.querySelector("bdi")?.textContent).toContain(offset);
    expect(container.textContent).toContain("2026");
  });
});
