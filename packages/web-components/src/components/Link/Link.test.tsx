import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Link } from "./index";

describe("Link component", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null!;
  });

  it("renders as a <a> tag when href is provided", () => {
    render(<Link href="https://allure-report.org">Click me</Link>, container);
    const linkElement = container.querySelector("a");
    expect(linkElement).not.toBeNull();
    expect(linkElement?.getAttribute("href")).toBe("https://allure-report.org");
    expect(linkElement?.textContent).toBe("Click me");
  });
});
