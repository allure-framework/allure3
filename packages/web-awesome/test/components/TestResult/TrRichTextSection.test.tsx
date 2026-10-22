import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { TrRichTextSection } from "@/components/TestResult/TrRichTextSection";
import { collapsedTrees } from "@/stores/tree";

vi.mock("@/components/MetadataButton", () => ({
  MetadataButton: ({ title, isOpened, setIsOpen }: { title: string; isOpened: boolean; setIsOpen: () => void }) => (
    <button type="button" aria-expanded={isOpened} onClick={setIsOpen}>
      {title}
    </button>
  ),
}));

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(async () => {
  cleanup();
  collapsedTrees.value = new Set();
  Object.defineProperties(URL, {
    createObjectURL: {
      configurable: true,
      value: createObjectURL,
    },
    revokeObjectURL: {
      configurable: true,
      value: revokeObjectURL,
    },
  });

  createObjectURL.mockClear();
  revokeObjectURL.mockClear();

  await epic("coverage");
  await feature("ui-components");
  await story("TrRichTextSection");
  await label("coverage", "ui-components");
});

describe("components > TestResult > TrRichTextSection", () => {
  it.each(["description", "precondition", "expectedResult"] as const)("sanitizes %s", (section) => {
    render(<TrRichTextSection id="test" section={section} html="<p>Safe</p><script>bad()</script>" />);
    const iframe = screen.getByTestId(`test-result-${section}-frame`);
    expect(iframe.getAttribute("srcdoc")).toContain("<p>Safe</p>");
    expect(iframe.getAttribute("srcdoc")).not.toContain("<script>");
    expect(iframe).toHaveAttribute("sandbox", "allow-same-origin");
    expect(iframe.getAttribute("title")).toBeTruthy();
  });

  it("keeps section and test-result collapse state independent", () => {
    const { rerender } = render(
      <>
        <TrRichTextSection id="first" section="description" html="<p>Description</p>" />
        <TrRichTextSection id="first" section="precondition" html="<p>Precondition</p>" />
        <TrRichTextSection id="first" section="expectedResult" html="<p>Expected</p>" />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(screen.getAllByRole("button")[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("test-result-precondition-frame")).not.toBeInTheDocument();
    expect(screen.getByTestId("test-result-description-frame")).toBeInTheDocument();
    expect(screen.getByTestId("test-result-expectedResult-frame")).toBeInTheDocument();
    expect(collapsedTrees.value.has("first-precondition")).toBe(true);

    rerender(<TrRichTextSection id="second" section="precondition" html="<p>Second</p>" />);
    expect(screen.getByTestId("test-result-precondition-frame")).toBeInTheDocument();
    rerender(<TrRichTextSection id="first" section="precondition" html="<p>First</p>" />);
    expect(screen.queryByTestId("test-result-precondition-frame")).not.toBeInTheDocument();
  });

  it("renders description iframe from inline srcdoc instead of a blob URL", () => {
    render(
      <TrRichTextSection
        id="test"
        section="description"
        html="<p><strong>Visible</strong> description</p><script>bad()</script>"
      />,
    );

    const iframe = screen.getByTestId("test-result-description-frame");
    const srcdoc = iframe.getAttribute("srcdoc");

    expect(iframe).not.toHaveAttribute("src");
    expect(srcdoc).toContain("<!DOCTYPE html>");
    expect(srcdoc).toContain("<strong>Visible</strong> description");
    expect(srcdoc).not.toContain("<script>");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
