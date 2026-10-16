import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { fetchAttachment } from "@allurereport/web-commons";
import { cleanup, render, waitFor } from "@testing-library/preact";
import { feature, story } from "allure-js-commons";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { AttachmentProps, I18nProp } from "./model";

vi.mock("@allurereport/web-commons", async (original) => ({
  ...(await original<typeof import("@allurereport/web-commons")>()),
  fetchAttachment: vi.fn(),
}));
beforeEach(async () => {
  vi.resetModules();
  await feature("lazy-report-components");
  await story("lazy-attachment-rendering");
  vi.mocked(fetchAttachment).mockResolvedValue({ text: "content" });
});
afterEach(() => {
  cleanup();
  for (const path of ["./AttachmentCode", "./MarkdownPreview", "./MermaidPreview", "./AttachmentTable"])
    vi.doUnmock(path);
});
const item = (contentType: string): AttachmentTestStepResult => ({
  type: "attachment",
  link: {
    id: "attachment",
    name: "attachment",
    contentType,
    ext: ".txt",
    originalFileName: "attachment.txt",
    used: true,
    missed: false,
  },
});

it("loads Markdown and source together, keeps panes mounted across toggles and passes fresh controls", async () => {
  const codeProps = vi.fn();
  vi.doMock("./AttachmentCode", () => ({
    AttachmentCode: (props: AttachmentProps) => {
      codeProps(props);
      return <div>source:{props.i18n?.("copy")}</div>;
    },
  }));
  vi.doMock("./MarkdownPreview", () => ({ MarkdownPreview: () => <div data-testid="preview">preview</div> }));
  const mermaid = vi.fn(() => ({ MermaidPreview: () => <div>mermaid</div> }));
  vi.doMock("./MermaidPreview", mermaid);
  const { Attachment } = await import("./Attachment");
  const i18n: I18nProp = { controls: (key: string) => `en:${key}`, imageDiff: (key) => key };
  const view = render(<Attachment item={item("text/markdown")} previewable i18n={i18n} />);
  await waitFor(() => expect(view.container.textContent).toContain("source:en:copy"));
  expect(view.container.textContent).toContain("preview");
  expect(mermaid).not.toHaveBeenCalled();
  const preview = view.getByTestId("preview");
  view.rerender(
    <Attachment
      item={item("text/markdown")}
      previewable={false}
      i18n={{ controls: (key: string) => `ru:${key}`, imageDiff: (key) => key }}
    />,
  );
  await waitFor(() => expect(view.container.textContent).toContain("source:ru:copy"));
  expect(view.getByTestId("preview")).toBe(preview);
  expect(view.container.querySelectorAll("[hidden]")).toHaveLength(1);
});

it("does not import a preview for unknown or downloadable attachments", async () => {
  const code = vi.fn(() => ({ AttachmentCode: () => <div>source</div> }));
  vi.doMock("./AttachmentCode", code);
  const { Attachment } = await import("./Attachment");
  const view = render(<Attachment item={item("unknown/content")} />);
  await waitFor(() => expect(view.container.textContent).toBe(""));
  view.rerender(<Attachment item={item("application/zip")} />);
  await waitFor(() => expect(view.container.textContent).toBe(""));
  expect(code).not.toHaveBeenCalled();
});

it("keeps the source pane after preview failure and can display a different attachment afterwards", async () => {
  vi.doMock("./MarkdownPreview", () => {
    throw new Error("Loading Markdown chunk failed");
  });
  vi.doMock("./AttachmentCode", () => ({ AttachmentCode: () => <div>source content</div> }));

  const { Attachment } = await import("./Attachment");
  const view = render(
    <div>
      <span>Report navigation</span>
      <Attachment item={item("text/markdown")} previewable />
    </div>,
  );
  await waitFor(() => expect(view.container.textContent).toContain("Failed to load attachment viewer"));
  expect(view.getByText("Report navigation").isConnected).toBe(true);
  const source = view.getByText("source content");
  expect(source.closest("[hidden]")).not.toBeNull();
  view.rerender(
    <div>
      <span>Report navigation</span>
      <Attachment item={item("text/markdown")} previewable={false} />
    </div>,
  );
  expect(view.getByText("source content")).toBe(source);
  expect(source.closest("[hidden]")).toBeNull();

  vi.mocked(fetchAttachment).mockResolvedValue({ text: "column\nrestored table" });
  view.rerender(
    <div>
      <span>Report navigation</span>
      <Attachment item={item("text/csv")} />
    </div>,
  );
  await waitFor(() => expect(view.container.textContent).toContain("restored table"));
  expect(view.queryByText("Failed to load attachment viewer")).toBeNull();
});

it("keeps the preview available when its source viewer import rejects", async () => {
  vi.doMock("./AttachmentCode", () => {
    throw new Error("Loading code chunk failed");
  });
  vi.doMock("./MarkdownPreview", () => ({ MarkdownPreview: () => <div>healthy preview</div> }));
  const { Attachment } = await import("./Attachment");
  const view = render(<Attachment item={item("text/markdown")} previewable />);
  await waitFor(() => expect(view.container.textContent).toContain("Failed to load attachment viewer"));
  await waitFor(() => expect(view.container.textContent).toContain("healthy preview"));
  expect(view.getByText("healthy preview").closest("[hidden]")).toBeNull();
  expect(view.getByText("Failed to load attachment viewer").closest("[hidden]")).not.toBeNull();
});
