import { render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "@/components/Footer";

vi.mock("@/components/Footer/FooterLogo", () => ({
  FooterLogo: () => <div data-testid="footer-logo" />,
}));

vi.mock("@allurereport/web-components", () => ({
  LanguagePicker: () => <div data-testid="footer-language-picker" />,
}));

vi.mock("@/components/Footer/FooterVersion", () => ({
  FooterVersion: () => <div data-testid="footer-version">Generated May 10, 2026 Ver: 3.8.2</div>,
}));

describe("components > Footer", () => {
  it("should render language picker near generated time and version", () => {
    render(<Footer />);

    expect(screen.getByTestId("footer-logo")).toBeInTheDocument();
    expect(screen.getByTestId("footer-language-picker")).toBeInTheDocument();
    expect(screen.getByTestId("footer-version")).toHaveTextContent("Generated");
  });
});
