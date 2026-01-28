import type { CategoryNode, CategoryNodeProps } from "@allurereport/core-api";
import { TreeHeader, TreeItem } from "@allurereport/web-components";
import clsx from "clsx";
import type { FC } from "preact/compat";
import { useState } from "preact/hooks";
import { reportStatsStore } from "@/stores";
import { navigateTo, route } from "@/stores/router";
import { collapsedTrees, toggleTree } from "@/stores/tree";
import * as styles from "./styles.scss";

export const CategoryTreeItem: FC<CategoryNodeProps> = ({ nodeId, store, depth }) => {
  const isEarlyCollapsed = Boolean(!collapsedTrees.value.has(nodeId));
  const [isOpened, setIsOpen] = useState<boolean>(isEarlyCollapsed);
  const node: CategoryNode = store.nodes[nodeId];
  const routeId = route.value.params?.testResultId;

  if (!node) {
    return null;
  }

  const onClick = () => {
    setIsOpen(!isOpened);
    toggleTree(nodeId);
  };

  if (node.type === "category") {
    return (
      <div className={styles["tree-item-category"]} id={nodeId}>
        <TreeHeader
          categoryTitle={node.name}
          isOpened={!isOpened}
          toggleTree={onClick}
          {...node}
          statistic={node.statistic}
          reportStatistic={reportStatsStore.value.data}
          statusFilter={"total"}
        />
        {!isOpened &&
          (node.childrenIds ?? []).map((cid: string) => (
            <div key={cid} className={styles["tree-content"]}>
              <CategoryTreeItem key={cid} nodeId={cid} store={store} depth={depth + 1} />
            </div>
          ))}
      </div>
    );
  }
  if (node.type === "message") {
    return (
      <div className={clsx(styles["tree-content"], styles["tree-item-message"])} id={nodeId}>
        <TreeHeader
          isOpened={!isOpened}
          categoryTitle={node.name}
          {...node}
          toggleTree={onClick}
          reportStatistic={reportStatsStore.value.data}
          statistic={node.statistic}
          statusFilter={"total"}
        />
        {!isOpened &&
          (node.childrenIds ?? []).map((cid, key) => (
            <CategoryTreeItem key={cid} nodeId={cid} store={store} depth={key} />
          ))}
      </div>
    );
  }
  if (node.type === "tr") {
    return (
      <div className={styles["tree-item"]} id={nodeId}>
        <TreeItem
          {...node}
          id={node.id}
          groupOrder={depth + 1}
          tooltips={{}}
          marked={node.id === routeId}
          navigateTo={() => navigateTo(`errorCategories/${nodeId}`)}
        />
      </div>
    );
  }
};
