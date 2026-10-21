import { cleanup, render, screen } from "@testing-library/preact";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { MiddleEllipsis } from "@/components/MiddleEllipsis";

beforeEach(async () => {
  await story("MiddleEllipsis");
});
beforeEach(() => {
  cleanup();
});

const SHA = "7978df3c8132d35f922679e1c72c4e3d26c95061";

describe("MiddleEllipsis", () => {
  it("keeps 8 first and 6 last characters by default", () => {
    render(<MiddleEllipsis text={SHA} />);

    expect(screen.getByTestId("middle-ellipsis").textContent).toBe("7978df3c…c95061");
  });

  it("keeps the passed number of the first and the last characters", () => {
    render(<MiddleEllipsis text={SHA} startLength={12} endLength={4} />);

    expect(screen.getByTestId("middle-ellipsis").textContent).toBe("7978df3c8132…5061");
  });

  it("uses the passed mark of the cut part", () => {
    render(<MiddleEllipsis text={SHA} startLength={4} endLength={4} ellipsis="..." />);

    expect(screen.getByTestId("middle-ellipsis").textContent).toBe("7978...5061");
  });

  it("puts the full text to the title only when something is cut", () => {
    render(<MiddleEllipsis text={SHA} />);

    expect(screen.getByTestId("middle-ellipsis").getAttribute("title")).toBe(SHA);
  });

  it("does not cut a text which is not longer than the start, the end and the mark together", () => {
    render(<MiddleEllipsis text="release/3.x-rc" startLength={8} endLength={5} />);

    const root = screen.getByTestId("middle-ellipsis");

    expect(root.textContent).toBe("release/3.x-rc");
    expect(root.hasAttribute("title")).toBe(false);
  });
});
