import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubtreeToggleButton } from "@/components/TestResult/TrSteps/SubtreeToggleButton";

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("SubtreeToggleButton");
  await label("coverage", "ui-components");
  cleanup();
});

describe("components > TestResult > SubtreeToggleButton", () => {
  it.each([
    ["expand-first-level", "expandFirstLevel"],
    ["collapse-to-first-level", "collapseToFirstLevel"],
    ["expand-all", "expandAll"],
    ["collapse-all", "collapseAll"],
  ] as const)("says what the click does for the %s action", (action, expectedLabel) => {
    render(<SubtreeToggleButton action={action} icon="icon" onClick={vi.fn()} data-testid="toggle" />);

    expect(screen.getByTestId("toggle").getAttribute("aria-label")).toBe(expectedLabel);
  });

  it("passes the click to the handler", () => {
    const onClick = vi.fn();

    render(<SubtreeToggleButton action="expand-all" icon="icon" onClick={onClick} data-testid="toggle" />);
    fireEvent.click(screen.getByTestId("toggle"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
