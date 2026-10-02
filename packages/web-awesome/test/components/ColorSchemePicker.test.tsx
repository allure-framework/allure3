import { render, screen, within } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { THEME_FAMILIES } from "@/stores/colorScheme";

vi.mock("@allurereport/web-commons", () => ({
  themeStore: { value: { current: "light", selected: "auto" } },
}));

vi.mock("@allurereport/web-components", () => {
  const Menu = ({ children, menuTrigger }: any) => (
    <div>
      {menuTrigger({ isOpened: false, onClick: vi.fn() })}
      <ul data-testid="menu">{children}</ul>
    </div>
  );
  Menu.Section = ({ children }: any) => <li>{children}</li>;
  Menu.ItemWithCheckmark = ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>;

  return {
    DropdownButton: ({ text, onClick }: { text: string; onClick: () => void }) => (
      <button data-testid="trigger" onClick={onClick}>
        {text}
      </button>
    ),
    Menu,
  };
});

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
    const menu = screen.getByTestId("menu");
    for (const family of THEME_FAMILIES) {
      expect(within(menu).getByText(family.label)).toBeInTheDocument();
    }
  });
});
