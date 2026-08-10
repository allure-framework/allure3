import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { SvgIcon, allureIcons } from "./index";

afterEach(() => {
  cleanup();
});

describe("SvgIcon", () => {
  it.each([allureIcons.lineAlertsAlertCircle, allureIcons.lineGeneralEye, allureIcons.lineIconBomb2])(
    "renders %s without the obsolete sprite reference",
    (id) => {
      const { container } = render(<SvgIcon id={id} data-testid="icon" />);

      const icon = screen.getByTestId("icon");

      expect(["IMG", "svg"]).toContain(icon.tagName);
      expect(container.querySelector("use")).toBeNull();
    },
  );

  it("does not render a broken sprite reference for unknown ids", () => {
    const { container } = render(<SvgIcon id="missing-icon" data-testid="icon" />);

    expect(screen.queryByTestId("icon")).toBeNull();
    expect(container.querySelector("use")).toBeNull();
  });
});
