import type { Statistic } from "@allurereport/core-api";
import { useSignal } from "@preact/signals";
import { For, Show } from "@preact/signals/utils";
import type { RecursiveTree } from "global";
import { useCallback, useMemo, useRef } from "preact/hooks";
import { Button, IconButton } from "../Button";
import { allureIcons } from "../SvgIcon";
import { Code, Text } from "../Typography";
import { TreeItemIcon } from "./TreeItemIcon";
import { TreeItemInfo } from "./TreeItemInfo";
import { TreeStatusBar } from "./TreeStatusBar";
import type { TreeGroupRow, TreeLeafRow, TreeRow } from "./hooks";
import { usePaginated, useTreeRows } from "./hooks";
import styles from "./paginated.styles.scss";
import { type TreeI18nProp, TreeI18nProvider } from "./treeI18nContext";

type Props = {
  statistic?: Statistic;
  tree: RecursiveTree;
  name?: string;
  root?: boolean;
  isNodeCollapsed: (node: RecursiveTree) => boolean;
  isNodeSelected?: (node: RecursiveTree) => boolean;
  onGroupClick: (row: TreeGroupRow) => void;
  onLeafClick: (row: TreeLeafRow) => void;
  i18n?: TreeI18nProp;
};

const ROW_OFFSET = 30;

export const LeafRow = (props: { onClick: () => void } & TreeLeafRow) => {
  const { onClick, data } = props;

  return (
    <div data-testid="tree" className={styles["tree-item"]} onClick={onClick} id={data.nodeId}>
      <TreeItemIcon status={data.status} />
      <Code data-testid="tree-leaf-order" size={"s"} className={styles.order}>
        {data.groupOrder}
      </Code>
      <Text data-testid="tree-leaf-title" className={styles["item-title"]}>
        {data.name}
      </Text>
      <TreeItemInfo
        data-testid="tree-leaf-info"
        duration={data.duration}
        flaky={data.flaky}
        retriesCount={data.retriesCount}
        transition={data.transition}
      />
    </div>
  );
};

const findPreviousFocusableGroupElement = (element: HTMLElement) => {
  let currentElement = element;
  while (currentElement.previousElementSibling) {
    currentElement = currentElement.previousElementSibling as HTMLElement;

    if (currentElement.dataset.type === "group") {
      const row = currentElement.querySelector("[data-row]");

      if (row instanceof HTMLElement) {
        return row;
      }
    }
  }
};

const PaginatedTreeRow = (
  props: TreeRow & {
    rootStatistic?: Statistic;
    isCollapsed?: boolean;
    isSelected?: boolean;
    onClick: (row: TreeRow) => void;
  },
) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { data, offset, type, isCollapsed, isSelected, onClick, rootStatistic } = props;

  const handleClick = useCallback(
    (e: MouseEvent | KeyboardEvent) => {
      if (window.getSelection()?.toString() !== "") {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      onClick(props);
    },
    [onClick, props],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        handleClick(e);
        return;
      }

      if (type === "group") {
        if (e.key === "ArrowRight" && isCollapsed) {
          handleClick(e);
          return;
        }

        if (e.key === "ArrowLeft" && !isCollapsed) {
          handleClick(e);
          return;
        }
      }

      if (type === "leaf") {
        if (e.key === "ArrowLeft") {
          const prevFocusableGroupElement = findPreviousFocusableGroupElement(wrapperRef.current!);

          if (prevFocusableGroupElement instanceof HTMLElement) {
            e.preventDefault();
            prevFocusableGroupElement.focus();
            return;
          }
        }
      }

      if (e.key === "ArrowUp") {
        const prevFocusableElement = wrapperRef.current?.previousElementSibling?.querySelector("[data-row]");
        if (prevFocusableElement instanceof HTMLElement) {
          e.preventDefault();
          prevFocusableElement.focus();
        }
      }

      if (e.key === "ArrowDown") {
        const nextFocusableElement = wrapperRef.current?.nextElementSibling?.querySelector("[data-row]");

        if (nextFocusableElement instanceof HTMLElement) {
          e.preventDefault();
          nextFocusableElement.focus();
        }
      }
    },
    [handleClick, type, isCollapsed],
  );

  if (type === "group" && !data.name) {
    return null;
  }

  return (
    <div
      className={styles.rowWrapper}
      style={{
        paddingLeft: offset * ROW_OFFSET,
      }}
      data-type={type}
      data-row-wrapper
      ref={wrapperRef}
    >
      <Text
        tag="div"
        size="m"
        type="paragraph"
        tabIndex={1}
        className={styles.row}
        data-selected={isSelected || undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        bold={type === "group"}
        id={data.nodeId ?? "rosot"}
        data-row
      >
        {type === "group" && (
          <div class={styles.toggle} tabIndex={-1}>
            <IconButton
              icon={isCollapsed ? allureIcons.lineArrowsChevronRight : allureIcons.lineArrowsChevronDown}
              data-testid="tree-arrow"
              size="xs"
              style="ghost"
              iconColor="secondary"
              onClick={handleClick}
            />
          </div>
        )}
        {type === "leaf" && <TreeItemIcon status={data.status} />}
        {type === "leaf" && (
          <Code data-testid="tree-leaf-order" size="s" className={styles.order}>
            {data.groupOrder}
          </Code>
        )}
        <div>{data.name}</div>
        {type === "group" && (
          <div className={styles.info}>
            <TreeStatusBar reportStatistic={rootStatistic} statusFilter={"total"} statistic={data.statistic} />
          </div>
        )}
        {type === "leaf" && (
          <div className={styles.info}>
            <TreeItemInfo
              data-testid="tree-leaf-info"
              duration={data.duration}
              flaky={data.flaky}
              retriesCount={data.retriesCount}
              transition={data.transition}
            />
          </div>
        )}
      </Text>
    </div>
  );
};

export const PaginatedTree = (props: Props) => {
  const { i18n, tree, name, root, statistic, isNodeCollapsed, onGroupClick, onLeafClick, isNodeSelected } = props;

  const treeWithRoot = useMemo(
    () => ({
      ...tree,
      name: tree.name ?? name,
      nodeId: tree.nodeId ?? "root",
      statistic: tree.statistic ?? statistic,
      leaves: tree.leaves ?? [],
      trees: tree.trees ?? [],
    }),
    [tree, name, statistic],
  );

  const rows = useTreeRows(treeWithRoot, isNodeCollapsed);

  const [paginatedRows, handleNextPage] = usePaginated(rows, 15);

  const handleClick = useCallback(
    (row: TreeRow) => {
      if (row.type === "group") {
        onGroupClick(row);
      } else {
        onLeafClick(row);
      }
    },
    [onGroupClick, onLeafClick],
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <TreeI18nProvider i18n={i18n}>
      <div className={styles.content} data-root={root || undefined}>
        <For each={paginatedRows.items}>
          {(row) => (
            <PaginatedTreeRow
              {...row}
              key={row.data.nodeId ?? "root"}
              isCollapsed={isNodeCollapsed(row.data)}
              isSelected={isNodeSelected?.(row.data)}
              onClick={handleClick}
              rootStatistic={statistic}
            />
          )}
        </For>
        <Show when={paginatedRows.hasNextPage}>
          <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
            <Button onClick={handleNextPage} text="Show more" style="outline" size="m" />
          </div>
        </Show>
      </div>
    </TreeI18nProvider>
  );
};
