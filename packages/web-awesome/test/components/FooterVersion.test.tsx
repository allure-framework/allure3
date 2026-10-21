import { signal } from "@preact/signals";
import { cleanup, render } from "@testing-library/preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { FooterVersion } from "@/components/Footer/FooterVersion";

const state = vi.hoisted(() => ({ options: {} as { createdAt?: number; allureVersion?: string } }));
const locale = signal("en-US");

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: () => state.options,
}));
vi.mock("@/stores", () => ({ useI18n: () => ({ t: () => "Generated" }) }));
vi.mock("@/stores/locale", () => ({
  currentLocaleIso: {
    get value() {
      return locale.value;
    },
  },
  currentLocale: { value: "en" },
  useI18n: () => ({ t: () => "at" }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  locale.value = "en-US";
});

describe("Awesome footer generation date", () => {
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

  it("updates the localized date without changing the instant or offset", async () => {
    state.options = { createdAt: Date.UTC(2026, 9, 20, 12, 34, 56), allureVersion: "3.21.0" };
    const { container, rerender } = render(<FooterVersion />);
    const before = container.textContent;
    const offset = new Intl.DateTimeFormat("en-US", { timeZoneName: "longOffset" })
      .formatToParts(state.options.createdAt)
      .find(({ type }) => type === "timeZoneName")?.value;
    await act(() => {
      locale.value = "de-DE";
    });
    rerender(<FooterVersion />);
    expect(container.textContent).not.toBe(before);
    expect(container.querySelector("bdi")?.textContent).toContain(offset);
    expect(container.textContent).toContain("2026");
  });
});
