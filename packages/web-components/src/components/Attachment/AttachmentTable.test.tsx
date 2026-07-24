import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { cleanup, render, screen, within } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { AttachmentTable } from "./AttachmentTable";

const attachmentItem = (contentType = "text/csv"): AttachmentTestStepResult => ({
  type: "attachment",
  link: {
    id: "table-attachment",
    name: "data.csv",
    originalFileName: "data.csv",
    ext: ".csv",
    contentType,
    used: true,
    missed: false,
  },
});

afterEach(() => {
  cleanup();
});

describe("AttachmentTable", () => {
  it("renders CSV attachment rows as a table", () => {
    render(
      <AttachmentTable
        attachment={{
          text: 'name,status,note,owner\n"Checkout, guest",passed,"line 1\r\nline 2","Ada ""QA"""\nSearch,failed,,',
        }}
        item={attachmentItem()}
      />,
    );

    const table = screen.getByTestId("table-attachment-content");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    const cells = within(table)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);

    expect(headers).toEqual(["name", "status", "note", "owner"]);
    expect(cells).toEqual(["Checkout, guest", "passed", "line 1\r\nline 2", 'Ada "QA"', "Search", "failed", "", ""]);
  });

  it("renders TSV attachments with tab separators", () => {
    render(
      <AttachmentTable
        attachment={{ text: "name\tvalue\nalpha\t1\nbeta\t2" }}
        item={attachmentItem("text/tab-separated-values")}
      />,
    );

    const table = screen.getByTestId("table-attachment-content");
    const rows = within(table).getAllByRole("row");

    expect(
      within(rows[0])
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["name", "value"]);
    expect(
      within(rows[1])
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["alpha", "1"]);
    expect(
      within(rows[2])
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["beta", "2"]);
  });
});
