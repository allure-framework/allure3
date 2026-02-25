import type { TestCategories } from "@allurereport/core-api";
import type { FC } from "preact/compat";
import { CategoryTreeItem } from "@/components/Categories/CategoryTreeItem";
import * as styles from "./styles.scss";

export const CategoriesTree: FC<{ store: TestCategories }> = ({ store }) => {
  return (
    <div className={styles["categories-tree-view"]}>
      {store.roots.map((id: string) => (
        <CategoryTreeItem key={id} nodeId={id} store={store} />
      ))}
    </div>
  );
};
