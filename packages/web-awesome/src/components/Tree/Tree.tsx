import type { Statistic } from "@allurereport/core-api";
import cx from "clsx";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import type { AllureAwesomeRecursiveTree, AllureAwesomeStatus } from "types";
import TreeItem from "@/components/Tree/TreeItem";
import { route } from "@/stores/router";
import { collapsedTrees, toggleTree } from "@/stores/tree";
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
  const { id } = route.value;
  const isEarlyCollapsed = collapsedTrees.value.has(tree.nodeId);
  const haveFailedSteps = statistic === undefined || !!statistic?.failed || !!statistic?.broken;
  const [isOpened, setIsOpen] = useState(() => (isEarlyCollapsed ? !haveFailedSteps : haveFailedSteps));

  const toggleTreeHeader = () => {
    setIsOpen(!isOpened);
    toggleTree(tree.nodeId);
  };
  const emptyTree = !tree?.trees?.length && !tree?.leaves?.length;

  if (emptyTree) {
    return null;
  }

  const treeContent = isOpened && (
    <div
      data-testid="tree-content"
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
          marked={leaf.nodeId === id}
        />
      ))}
    </div>
  );

  return (
    <div className={styles.tree}>
      {name && (
        <TreeHeader categoryTitle={name} isOpened={isOpened} toggleTree={toggleTreeHeader} statistic={statistic} />
      )}
      {treeContent}
    </div>
  );
};

export default Tree;
