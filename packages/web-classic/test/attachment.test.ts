// @vitest-environment jsdom
import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { step } from "allure-js-commons";
import { createElement, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { Attachment } from "../src/components/TestResult/TestResultSteps/attachment.js";

vi.mock("@allurereport/web-components", () => ({
  Spinner: () => createElement("div", null, "Loading"),
  AttachmentTable: () => null,
  MarkdownPreview: () => null,
}));

const { fetchAttachment } = vi.hoisted(() => ({ fetchAttachment: vi.fn() }));
vi.mock("@/utils/attachments", async (importOriginal) => ({ ...(await importOriginal()), fetchAttachment }));
vi.mock("@/components/Modal", () => ({ modalData: { value: {} } }));
vi.mock("@/components/TestResult/TestResultSteps/wrongAttachment", () => ({
  EmptyComponent: () => createElement("div", null, "Load failed"),
}));

const container = document.createElement("div");
const show = async (id: string, contentType = "text/plain") => {
  const item: AttachmentTestStepResult = {
    type: "attachment",
    link: { id, contentType, ext: ".txt", name: id, originalFileName: id, used: true, missed: false },
  };
  await act(() => render(createElement(Attachment, { item }), container));
};
const request = () => {
  const pending = Promise.withResolvers<{ text: string } | { img: string } | { src: string }>();
  fetchAttachment.mockReturnValueOnce(pending.promise);
  return pending;
};

afterEach(async () => {
  await act(() => render(null, container));
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it.each(["success", "error"])("keeps the current Classic selection after stale %s", async (outcome) => {
  const old = request();
  const current = request();
  await show("old");
  await show("current");
  expect(container.textContent).not.toContain("STALE_PAYLOAD");
  await act(async () => current.resolve({ text: "CURRENT_PAYLOAD" }));
  await step("Complete the superseded request last", async () => {
    await act(async () => {
      if (outcome === "success") old.resolve({ text: "STALE_PAYLOAD" });
      else old.reject(new Error("stale failure"));
    });
    expect(container.textContent).toContain("CURRENT_PAYLOAD");
    expect(container.textContent).not.toContain("STALE_PAYLOAD");
    expect(container.textContent).not.toContain("Load failed");
  });
});

it.each([
  ["image/png", "img"],
  ["video/mp4", "src"],
] as const)("owns Classic %s URLs through replacement and unmount", async (contentType, field) => {
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static revokeObjectURL = revokeObjectURL;
    },
  );
  const first = request();
  const late = request();
  await show("first", contentType);
  await act(async () => first.resolve({ [field]: "blob:first" } as { img: string } | { src: string }));
  expect(container.querySelector("img, source")?.getAttribute("src")).toBe("blob:first");
  expect(revokeObjectURL).not.toHaveBeenCalled();
  await show("late", contentType);
  expect(container.querySelector("img, source")).toBeNull();
  expect(revokeObjectURL.mock.calls).toEqual([["blob:first"]]);
  await act(() => render(null, container));
  await act(async () => late.resolve({ [field]: "blob:late" } as { img: string } | { src: string }));
  expect(revokeObjectURL.mock.calls).toEqual([["blob:first"], ["blob:late"]]);
});

it("shows the existing Classic fallback when the current request fails", async () => {
  const failed = request();
  await show("failed");
  await act(async () => failed.reject(new Error("current failure")));
  expect(container.textContent).toBe("Load failed");
});
