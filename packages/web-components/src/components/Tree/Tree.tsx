import type { Statistic } from "@allurereport/core-api";
import cx from "clsx";
import type { RecursiveTree, Status } from "global";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { TreeItem } from "@/components/Tree/TreeItem";
import { TreeHeader } from "./TreeHeader";
import styles from "./styles.scss";

interface TreeProps {
  statistic?: Statistic;
  reportStatistic?: Statistic;
  tree: RecursiveTree;
  name?: string;
  root?: boolean;
  statusFilter?: Status;
  collapsedTrees: Set<string>;
  toggleTree: (id: string) => void;
  navigateTo: (id: string) => void;
  routeId?: string;
}

export const Tree: FunctionalComponent<TreeProps> = ({
  tree,
  statusFilter,
  root,
  name,
  statistic,
  reportStatistic,
  collapsedTrees,
  toggleTree,
  routeId,
  navigateTo,
}) => {
  const isEarlyCollapsed = collapsedTrees.has(tree.nodeId as string);
  const haveFailedSteps = statistic === undefined || !!statistic?.failed || !!statistic?.broken;
  const [isOpened, setIsOpen] = useState(() => root || (isEarlyCollapsed ? !haveFailedSteps : haveFailedSteps));
  const toggleTreeHeader = () => {
    setIsOpen(!isOpened);
    toggleTree(tree.nodeId as string);
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
          reportStatistic={reportStatistic}
          statusFilter={statusFilter}
          collapsedTrees={collapsedTrees}
          toggleTree={toggleTree}
          routeId={routeId}
          navigateTo={navigateTo}
        />
      ))}
      {tree?.leaves?.map?.((leaf) => (
        <TreeItem
          data-testid="tree-leaf"
          key={leaf.nodeId}
          id={leaf.nodeId}
          name={leaf.name}
          status={leaf.status}
          groupOrder={leaf.groupOrder as number}
          duration={leaf.duration}
          retriesCount={leaf.retriesCount}
          flaky={leaf.flaky}
          marked={leaf.nodeId === routeId}
          navigateTo={navigateTo}
        />
      ))}
    </div>
  );

  return (
    <div className={styles.tree}>
      {name && (
        <TreeHeader
          statusFilter={statusFilter}
          categoryTitle={name}
          isOpened={isOpened}
          toggleTree={toggleTreeHeader}
          statistic={statistic}
          reportStatistic={reportStatistic}
        />
      )}
      {treeContent}
    </div>
  );
};
