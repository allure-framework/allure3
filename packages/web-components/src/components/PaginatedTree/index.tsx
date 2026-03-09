import { For, Show } from "@preact/signals/utils";
import type { ComponentChild } from "preact";
import { useCallback, useMemo, useRef } from "preact/hooks";
import { Button } from "../Button/index.js";
import { Text } from "../Typography/index.js";
import { usePaginated, useRows } from "./hooks.js";
import type { Tree, TreeGroup, TreeLeaf, TreeRow } from "./model.js";
import { RenderContextProvider, useRenderContext } from "./renderContext.js";
import styles from "./styles.scss";
import { findPreviousFocusableGroupEl } from "./utils.js";

type Props<T extends Record<string, any>> = {
  tree: Tree<T>;
  root?: boolean;
  onGroupClick: (group: TreeGroup<T>) => void;
  onGroupKeyDown: (group: TreeGroup<T>, key: "ArrowRight" | "ArrowLeft", event: KeyboardEvent) => void;
  onLeafClick: (leaf: TreeLeaf<T>) => void;
  renderLeaf: (leaf: TreeLeaf<T>) => ComponentChild;
  renderMore?: (props: { onClick: () => void }) => ComponentChild;
  renderGroup: (group: TreeGroup<T>) => ComponentChild;
  filterGroup?: (group: TreeGroup<T>) => boolean;
  pageSize?: number;
};

const ROW_OFFSET = 30;

const MoreBtn = (props: { onClick: () => void }) => {
  return <Button onClick={props.onClick} text="Show more" style="outline" size="m" />;
};

// export const LeafRow = <T,>(props: { onClick: () => void } & TreeLeafRow<T>) => {
//   const { onClick, data } = props;

//   return (
//     <div data-testid="tree" className={styles["tree-item"]} onClick={onClick} id={data.nodeId}>
//       <TreeItemIcon status={data.status} />
//       <Code data-testid="tree-leaf-order" size={"s"} className={styles.order}>
//         {data.groupOrder}
//       </Code>
//       <Text data-testid="tree-leaf-title" className={styles["item-title"]}>
//         {data.name}
//       </Text>
//       <TreeItemInfo
//         data-testid="tree-leaf-info"
//         duration={data.duration}
//         flaky={data.flaky}
//         retriesCount={data.retriesCount}
//         transition={data.transition}
//       />
//     </div>
//   );
// };

const PaginatedTreeRow = <T,>(props: TreeRow<T>) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { data, offset, type } = props;
  const { onGroupClick, onLeafClick, onGroupKeyDown, renderLeaf, renderGroup } = useRenderContext();

  const handleClick = useCallback(
    (e: MouseEvent | KeyboardEvent) => {
      if (window.getSelection()?.toString() !== "") {
        return;
      }
      e.stopPropagation();
      e.preventDefault();

      if (type === "group") {
        onGroupClick(data);
      } else {
        onLeafClick(data);
      }
    },
    [onGroupClick, onLeafClick, data, type],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        handleClick(e);
        return;
      }

      if (type === "group") {
        if (e.key === "ArrowRight") {
          onGroupKeyDown(data, "ArrowRight", e);
          return;
        }

        if (e.key === "ArrowLeft") {
          onGroupKeyDown(data, "ArrowLeft", e);
          return;
        }
      }

      if (type === "leaf") {
        if (e.key === "ArrowLeft") {
          const prevFocusableGroupElement = findPreviousFocusableGroupEl(wrapperRef.current!);

          if (prevFocusableGroupElement instanceof HTMLElement) {
            e.preventDefault();
            prevFocusableGroupElement.focus();
            return;
          }
        }

        if (e.key === "ArrowRight") {
          const prevFocusableGroupElement = findPreviousFocusableGroupEl(wrapperRef.current!);

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
    [handleClick, type, onGroupKeyDown, data],
  );

  const content = useMemo(() => {
    if (type === "group") {
      return renderGroup(data);
    }

    if (type === "leaf") {
      return renderLeaf(data);
    }

    return null;
  }, [type, data, renderGroup, renderLeaf]);

  if (!content) {
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
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        bold={type === "group"}
        id={data.nodeId ?? "rosot"}
        data-row
      >
        {content}
        {/* {type === "group" && (
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
        )} */}
      </Text>
    </div>
  );
};

export const PaginatedTree = <T extends Record<string, any>>(props: Props<T>) => {
  const {
    tree,
    root,
    onGroupClick,
    onGroupKeyDown,
    onLeafClick,
    renderLeaf,
    renderGroup,
    filterGroup,
    pageSize,
    renderMore,
  } = props;

  const rows = useRows(tree, filterGroup);
  const [{ items, hasNextPage }, handleNextPage] = usePaginated(rows, pageSize);

  if (rows.length === 0) {
    return null;
  }

  return (
    <RenderContextProvider<T>
      onGroupClick={onGroupClick}
      renderGroup={renderGroup}
      onGroupKeyDown={onGroupKeyDown}
      onLeafClick={onLeafClick}
      renderLeaf={renderLeaf}
    >
      <div className={styles.content} data-root={root || undefined}>
        <For each={items}>{(row) => <PaginatedTreeRow key={row.data.nodeId ?? "root"} {...row} />}</For>
        <Show when={hasNextPage}>
          <div className={styles.more}>
            {typeof renderMore === "function" ? (
              renderMore({ onClick: handleNextPage })
            ) : (
              <Button onClick={handleNextPage} text="Show more" style="outline" size="m" />
            )}
          </div>
        </Show>
      </div>
    </RenderContextProvider>
  );
};
