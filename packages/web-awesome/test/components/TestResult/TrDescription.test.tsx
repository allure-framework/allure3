import { render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrDescription } from "@/components/TestResult/TrDescription";

vi.mock("@/components/MetadataButton", () => ({
  MetadataButton: () => <button type="button">Description</button>,
}));

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(async () => {
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
  await story("TrDescription");
  await label("coverage", "ui-components");
});

describe("components > TestResult > TrDescription", () => {
  it("renders description iframe from inline srcdoc instead of a blob URL", () => {
    render(<TrDescription descriptionHtml="<p><strong>Visible</strong> description</p><script>bad()</script>" />);

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
