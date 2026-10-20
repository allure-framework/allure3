import { copyToClipboard } from "@allurereport/web-commons";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { Menu } from "@/components/Menu";

// the copy goes through the helper of web-commons, which has the fallback for the pages without the clipboard API
vi.mock("@allurereport/web-commons", () => ({ copyToClipboard: vi.fn() }));

beforeEach(async () => {
  await story("Menu");
});
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderMenu = (items: preact.ComponentChildren, size?: "xs" | "m") =>
  render(
    <Menu size={size} isInitialOpened menuTrigger={({ onClick }) => <button onClick={onClick}>trigger</button>}>
      <Menu.Section>{items}</Menu.Section>
    </Menu>,
  );

describe("Menu", () => {
  it("renders an item with the href as a link to a new tab", () => {
    renderMenu(
      <Menu.Item href="https://example.com/pull/1" dataTestId="item">
        Pull request
      </Menu.Item>,
    );

    const link = screen.getByTestId("item");

    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://example.com/pull/1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("closes the menu after the link of an item is followed, not before", async () => {
    renderMenu(
      <Menu.Item href="https://example.com/pull/1" dataTestId="item">
        Pull request
      </Menu.Item>,
    );

    const link = screen.getByTestId("item");

    fireEvent.click(link);
    await Promise.resolve();

    expect(link.isConnected).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(link.isConnected).toBe(false);
  });

  it("renders an item with the click handler as a button and the plain one as a text", () => {
    const onClick = vi.fn();

    renderMenu(
      <>
        <Menu.Item onClick={onClick} dataTestId="button">
          Copy
        </Menu.Item>
        <Menu.Item dataTestId="text">Branch</Menu.Item>
      </>,
    );

    expect(screen.getByTestId("button").tagName).toBe("BUTTON");
    expect(screen.getByTestId("text").tagName).toBe("DIV");

    fireEvent.click(screen.getByTestId("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the items of the xs menu", () => {
    renderMenu(<Menu.Item>Branch</Menu.Item>, "xs");

    expect(document.querySelector("aside")).not.toBeNull();
    expect(screen.getByText("Branch")).toBeTruthy();
  });

  describe("copyValue", () => {
    const VALUE = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";
    const rightSlotOf = (item: HTMLElement) => item.querySelectorAll("svg, img")[0].outerHTML;

    it("copies the whole value by a click, shows the checkmark and keeps the menu opened", async () => {
      (copyToClipboard as Mock).mockResolvedValue(true);
      renderMenu(
        <Menu.Item copyValue={VALUE} dataTestId="item">
          0a1b2c3d…234567
        </Menu.Item>,
      );

      const item = screen.getByTestId("item");
      const iconBefore = rightSlotOf(item);

      expect(item.tagName).toBe("BUTTON");
      expect(item.querySelectorAll("svg, img")).toHaveLength(1);

      fireEvent.click(item);

      await waitFor(() => expect(rightSlotOf(item)).not.toBe(iconBefore));
      expect(copyToClipboard).toHaveBeenCalledWith(VALUE);
      expect(document.querySelector("aside")).not.toBeNull();
    });

    it("does not show the checkmark when the value is not copied", async () => {
      (copyToClipboard as Mock).mockResolvedValue(false);
      renderMenu(
        <Menu.Item copyValue={VALUE} dataTestId="item">
          Value
        </Menu.Item>,
      );

      const item = screen.getByTestId("item");
      const iconBefore = rightSlotOf(item);

      fireEvent.click(item);

      await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(VALUE));
      await Promise.resolve();

      expect(rightSlotOf(item)).toBe(iconBefore);
    });

    it("is not copyable when the item is a link or has its own handler", () => {
      renderMenu(
        <>
          <Menu.Item copyValue="value" href="https://example.com" dataTestId="link">
            Link
          </Menu.Item>
          <Menu.Item copyValue="value" onClick={() => {}} dataTestId="button">
            Button
          </Menu.Item>
        </>,
      );

      expect(screen.getByTestId("link").tagName).toBe("A");
      expect(screen.getByTestId("link").querySelectorAll("svg, img")).toHaveLength(0);
      expect(screen.getByTestId("button").querySelectorAll("svg, img")).toHaveLength(0);
    });
  });
});
