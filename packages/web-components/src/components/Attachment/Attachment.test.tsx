import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { AttachmentData } from "@allurereport/web-commons";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { step } from "allure-js-commons";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { Attachment } from "./Attachment";

const { fetchAttachment } = vi.hoisted(() => ({ fetchAttachment: vi.fn() }));
vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAttachment,
}));

const item = (id: string, contentType = "text/plain"): AttachmentTestStepResult => ({
  type: "attachment",
  link: { id, contentType, ext: ".txt", name: id, originalFileName: id, used: true, missed: false },
});
const request = () => {
  const pending = Promise.withResolvers<AttachmentData>();
  fetchAttachment.mockReturnValueOnce(pending.promise);
  return pending;
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it.each(["success", "error"])("ignores stale %s while the selected attachment is loading", async (outcome) => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static revokeObjectURL = vi.fn();
    },
  );
  const old = request();
  const current = request();
  const view = render(<Attachment item={item("old", "video/mp4")} />);
  await waitFor(() => expect(fetchAttachment).toHaveBeenCalledTimes(1));
  view.rerender(<Attachment item={item("current", "video/mp4")} />);
  await waitFor(() => expect(fetchAttachment).toHaveBeenCalledTimes(2));
  await step("Complete the old request while the current one is pending", async () => {
    await act(async () => {
      if (outcome === "success") old.resolve({ src: "blob:stale" });
      else old.reject(new Error("stale failure"));
    });
    expect(view.container.querySelector("source")).toBeNull();
    expect(screen.queryByText("Failed to load attachment")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
  await act(async () => current.resolve({ src: "blob:current" }));
  expect(view.container.querySelector("source")?.getAttribute("src")).toBe("blob:current");
});

it.each(["success", "error"])("ignores stale %s after the selected attachment has loaded", async (outcome) => {
  const old = request();
  const current = request();
  const view = render(<Attachment item={item("old")} />);
  await waitFor(() => expect(fetchAttachment).toHaveBeenCalledTimes(1));
  view.rerender(<Attachment item={item("current")} />);
  await waitFor(() => expect(fetchAttachment).toHaveBeenCalledTimes(2));
  await act(async () => current.resolve({ text: "CURRENT_PAYLOAD" }));
  await screen.findByText("CURRENT_PAYLOAD");
  await step("Resolve the superseded request last and keep the selected payload", async () => {
    await act(async () => {
      if (outcome === "success") old.resolve({ text: "STALE_PAYLOAD" });
      else old.reject(new Error("stale failure"));
    });
    expect(screen.queryByText("CURRENT_PAYLOAD")).not.toBeNull();
    expect(screen.queryByText("STALE_PAYLOAD")).toBeNull();
    expect(screen.queryByText("Failed to load attachment")).toBeNull();
  });
});

it.each([
  ["image/png", "img"],
  ["image/svg+xml", "img"],
  ["video/mp4", "src"],
] as const)("releases owned %s URLs on replacement, late completion and unmount", async (contentType, field) => {
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static revokeObjectURL = revokeObjectURL;
    },
  );
  const first = request();
  const stale = request();
  const current = request();
  const late = request();
  const data = (name: string) => ({ [field]: `blob:${name}` }) as AttachmentData;
  const view = render(<Attachment item={item("first", contentType)} />);
  await act(async () => first.resolve(data("first")));
  await waitFor(() => expect(view.container.querySelector("img, source")?.getAttribute("src")).toBe("blob:first"));
  expect(revokeObjectURL).not.toHaveBeenCalled();
  view.rerender(<Attachment item={item("stale", contentType)} />);
  expect(revokeObjectURL.mock.calls).toEqual([["blob:first"]]);
  view.rerender(<Attachment item={item("current", contentType)} />);
  await act(async () => current.resolve(data("current")));
  await act(async () => stale.resolve(data("stale")));
  await step("Discard the stale URL without revoking the visible URL", async () => {
    expect(revokeObjectURL.mock.calls).toEqual([["blob:first"], ["blob:stale"]]);
    expect(view.container.querySelector("img, source")?.getAttribute("src")).toBe("blob:current");
  });
  view.rerender(<Attachment item={item("late", contentType)} />);
  view.unmount();
  await act(async () => late.resolve(data("late")));
  expect(revokeObjectURL.mock.calls).toEqual([["blob:first"], ["blob:stale"], ["blob:current"], ["blob:late"]]);
});

it("retries a current failure and releases the successful preview on unmount", async () => {
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static revokeObjectURL = revokeObjectURL;
    },
  );
  const failed = request();
  const retried = request();
  const view = render(<Attachment item={item("image", "image/png")} />);
  await act(async () => failed.reject(new Error("current failure")));
  await screen.findByText("Failed to load attachment");
  fireEvent.click(screen.getByRole("button"));
  await act(async () => retried.resolve({ img: "blob:retried" }));
  await waitFor(() => expect(view.container.querySelector("img")?.src).toBe("blob:retried"));
  expect(revokeObjectURL).not.toHaveBeenCalled();
  view.unmount();
  expect(revokeObjectURL.mock.calls).toEqual([["blob:retried"]]);
});
