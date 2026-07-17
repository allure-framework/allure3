import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LinkifiedText } from "./index";

describe("LinkifiedText", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null!;
  });

  it("renders a clickable link for http urls in text", () => {
    render(<LinkifiedText data-testid="step-title" text="Web site http://example.com/" />, container);

    const title = container.querySelector('[data-testid="step-title"]');

    expect(title?.textContent).toBe("Web site http://example.com/");

    const link = container.querySelector("a");

    expect(link?.getAttribute("href")).toBe("http://example.com/");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toBe("http://example.com/");
  });

  it("renders plain text when the url is unsafe", () => {
    render(<LinkifiedText text="bad javascript:alert(1) end" />, container);

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("javascript:alert(1)");
  });
});
