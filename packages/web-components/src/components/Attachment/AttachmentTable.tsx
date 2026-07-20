import { csvParseRows, tsvParseRows } from "d3-dsv";
import { useMemo } from "preact/hooks";

import { EmptyView } from "@/components/EmptyView";

import type { AttachmentProps } from "./model";

import styles from "./styles.scss";

const parseDelimitedRows = (text: string, contentType?: string): string[][] => {
  const normalizedType = contentType?.split(";")[0].trim().toLowerCase();

  if (normalizedType === "text/tab-separated-values") {
    return tsvParseRows(text);
  }

  return csvParseRows(text);
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
