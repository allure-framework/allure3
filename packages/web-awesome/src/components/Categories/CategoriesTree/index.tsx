import type { TestCategories } from "@allurereport/core-api";
import { scrollFocusIntoView } from "@allurereport/web-commons";
import type { FC } from "preact/compat";
import { useLayoutEffect } from "preact/hooks";

import { CategoryTreeItem } from "@/components/Categories/CategoryTreeItem";
import { pendingCategoryScrollId } from "@/stores/categories";

import * as styles from "./styles.scss";

export const CategoriesTree: FC<{ store: TestCategories }> = ({ store }) => {
  const scrollToNodeId = pendingCategoryScrollId.value;

  useLayoutEffect(() => {
    if (!scrollToNodeId) {
      return;
    }

    pendingCategoryScrollId.value = undefined;

    const node = document.getElementById(scrollToNodeId);

    if (node) {
      scrollFocusIntoView(node, { kind: "group" });
    }
  }, [scrollToNodeId]);

  return (
    <div className={styles["categories-tree-view"]}>
      {store.roots.map((id: string) => (
        <CategoryTreeItem key={id} nodeId={id} store={store} />
      ))}
    </div>
  );
};
