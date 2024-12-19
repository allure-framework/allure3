import type { Statistic } from "@allurereport/core-api";
import cx from "clsx";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import TreeItem from "@/components/app/Tree/TreeItem";
import { Text } from "@/components/commons/Typography";
import { useI18n } from "@/stores";
import type { AllureAwesomeRecursiveTree, AllureAwesomeStatus } from "../../../../types";
import TreeHeader from "./TreeHeader";
import * as styles from "./styles.scss";

interface TreeProps {
  statistic?: Statistic;
  tree: AllureAwesomeRecursiveTree;
  name?: string;
  root?: boolean;
  statusFilter?: AllureAwesomeStatus;
}

const Tree: FunctionComponent<TreeProps> = ({ tree, statusFilter, root, name, statistic }) => {
  const { t } = useI18n("empty");
  const [isOpened, setIsOpen] = useState(statistic === undefined || !!statistic.failed || !!statistic.broken);
  const toggleTree = () => {
    setIsOpen(!isOpened);
  };
  const emptyTree = !tree?.trees?.length && !tree?.leaves?.length;

  if (emptyTree) {
    return (
      <div className={styles["tree-list"]}>
        <div className={styles["tree-empty-results"]}>
          <Text className={styles["tree-empty-results-title"]}>{t("no-results")}</Text>
        </div>
      </div>
    );
  }

  const treeContent = isOpened && (
    <div
      className={cx({
        [styles["tree-content"]]: true,
        [styles.root]: root,
      })}
    >
      {tree?.trees?.map?.((subTree) => (
        <Tree
          key={subTree.nodeId}
          name={subTree.name}
          tree={subTree}
          statistic={subTree.statistic}
          statusFilter={statusFilter}
        />
      ))}
      {tree?.leaves?.map?.((leaf) => (
        <TreeItem
          data-testid="tree-leaf"
          key={leaf.nodeId}
          id={leaf.nodeId}
          name={leaf.name}
          status={leaf.status}
          groupOrder={leaf.groupOrder}
          duration={leaf.duration}
        />
      ))}
    </div>
  );

  return (
    <div className={styles.tree}>
      {name && (
        <TreeHeader
          categoryTitle={name}
          isOpened={isOpened}
          toggleTree={toggleTree}
          statistic={statistic}
          data-testid="tree-group-header"
        />
      )}
      {treeContent}
    </div>
  );
};

export default Tree;
