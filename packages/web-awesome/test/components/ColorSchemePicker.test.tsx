import { render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { THEME_FAMILIES } from "@/stores/colorScheme";

vi.mock("@allurereport/web-commons", () => ({
  themeStore: { value: { current: "light", selected: "auto" } },
}));

vi.mock("@allurereport/web-components", () => ({
  DropdownButton: ({ text, onClick }: { text: string; onClick: () => void }) => (
    <button data-testid="trigger" onClick={onClick}>
      {text}
    </button>
  ),
  Menu: ({ children, menuTrigger }: any) => (
    <div>
      {menuTrigger({ isOpened: false, onClick: vi.fn() })}
      <ul data-testid="menu">{children}</ul>
    </div>
  ),
}));

vi.mock("@/stores/colorScheme", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/colorScheme")>();
  return {
    ...actual,
    selectedFamily: { value: "allure" },
    setThemeFamily: vi.fn(),
  };
});

describe("components > ColorSchemePicker", () => {
  it("shows current family label on trigger", async () => {
    const { ColorSchemePicker } = await import("@/components/ColorSchemePicker/ColorSchemePicker");
    render(<ColorSchemePicker />);
    expect(screen.getByTestId("trigger")).toHaveTextContent("Allure");
  });

  it("renders all theme families", async () => {
    const { ColorSchemePicker } = await import("@/components/ColorSchemePicker/ColorSchemePicker");
    render(<ColorSchemePicker />);
    for (const family of THEME_FAMILIES) {
      expect(screen.getByText(family.label)).toBeInTheDocument();
    }
  });
});
