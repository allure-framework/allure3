import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

import { MetadataSummary } from "@/components/ReportMetadata/MetadataSummary";

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
});

describe("components > MetadataSummary", () => {
  it("renders retry and retry status change counters independently and in order", () => {
    render(<MetadataSummary stats={{ total: 2, retries: 2, retriesStatusChange: 1 }} />);

    const retries = screen.getByTestId("metadata-item-retries");
    const retriesStatusChange = screen.getByTestId("metadata-item-retriesStatusChange");

    expect(retries).toHaveTextContent("retries2");
    expect(retriesStatusChange).toHaveTextContent("retriesStatusChange1");
    expect(retries.compareDocumentPosition(retriesStatusChange) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it.each([undefined, 0])("does not render a retry status change counter when the value is %s", (value) => {
    render(<MetadataSummary stats={{ total: 1, retries: 1, retriesStatusChange: value }} />);

    expect(screen.queryByTestId("metadata-item-retriesStatusChange")).toBeNull();
  });
});
