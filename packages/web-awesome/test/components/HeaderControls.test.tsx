import { render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { HeaderControls } from "@/components/HeaderControls";

vi.mock("@/components/EnvironmentPicker", () => ({
  EnvironmentPicker: () => <div data-testid="environment-picker" />,
}));

vi.mock("@/components/ToggleLayout", () => ({
  default: () => <div data-testid="toggle-layout" />,
}));

vi.mock("@allurereport/web-components", () => ({
  ThemeButton: () => <button data-testid="theme-button" type="button" />,
  LanguagePicker: () => <button data-testid="language-picker" type="button" />,
}));

describe("components > HeaderControls", () => {
  it("should keep frequent controls in header and omit language picker", () => {
    render(<HeaderControls />);

    expect(screen.getByTestId("environment-picker")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-layout")).toBeInTheDocument();
    expect(screen.getByTestId("theme-button")).toBeInTheDocument();
    expect(screen.queryByTestId("language-picker")).not.toBeInTheDocument();
  });
});
