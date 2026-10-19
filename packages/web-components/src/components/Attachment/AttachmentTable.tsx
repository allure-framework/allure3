import { useMemo } from "preact/hooks";

import { EmptyView } from "@/components/EmptyView";

import type { AttachmentProps } from "./model";

import styles from "./styles.scss";

const parseDelimitedText = (text: string, delimiter: string): string[][] => {
  if (text.length === 0) {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let hasPendingRow = false;

  const appendField = () => {
    row.push(field);
    field = "";
  };

  const appendRow = () => {
    appendField();
    rows.push(row);
    row = [];
    hasPendingRow = false;
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true;
      hasPendingRow = true;
    } else if (char === delimiter) {
      appendField();
      hasPendingRow = true;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index++;
      }

      if (hasPendingRow || field.length > 0 || row.length > 0) {
        appendRow();
      }
    } else {
      field += char;
      hasPendingRow = true;
    }
  }

  if (hasPendingRow || field.length > 0 || row.length > 0) {
    appendRow();
  }

  return rows;
};

const parseDelimitedRows = (text: string, contentType?: string): string[][] => {
  const normalizedType = contentType?.split(";")[0].trim().toLowerCase();

  return parseDelimitedText(text, normalizedType === "text/tab-separated-values" ? "\t" : ",");
};

const normalizeRow = (row: string[], columnCount: number): string[] =>
  Array.from({ length: columnCount }, (_, index) => row[index] ?? "");

export const AttachmentTable = ({ attachment, item }: AttachmentProps) => {
  const rawText = attachment && "text" in attachment ? (attachment.text ?? "") : "";
  const rows = useMemo(() => parseDelimitedRows(rawText, item.link.contentType), [rawText, item.link.contentType]);

  if (rows.length === 0) {
    return <EmptyView description="No table data" size="xs" fullHeight={false} />;
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const [headerRow, ...bodyRows] = rows;
  const headerCells = normalizeRow(headerRow, columnCount);

  return (
    <div className={styles["test-result-attachment-table-wrapper"]} data-testid="table-attachment-content">
      <table className={styles["test-result-attachment-table"]}>
        <thead>
          <tr>
            {headerCells.map((cell, index) => (
              <th key={index} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {normalizeRow(row, columnCount).map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
