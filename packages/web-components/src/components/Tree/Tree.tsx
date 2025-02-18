import type { Statistic } from "@allurereport/core-api";
import cx from "clsx";
import type { AllureAwesomeRecursiveTree, AllureAwesomeStatus, TreeFiltersState } from "global";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import type { StoreSignalState } from "@/components/Loadable";
import { TreeItem } from "@/components/Tree/TreeItem";
import { TreeHeader } from "./TreeHeader";
import styles from "./styles.scss";

interface TreeProps {
  statistic?: Statistic;
  tree: AllureAwesomeRecursiveTree;
  name?: string;
  root?: boolean;
  statusFilter?: AllureAwesomeStatus;
  collapsedTrees: Set<string>;
  toggleTree: (id: string) => void;
  navigateTo: (id: string) => void;
  routeId?: string;
  statsStore: StoreSignalState<Statistic>;
  treeFiltersStore: TreeFiltersState;
}

export const Tree: FunctionComponent<TreeProps> = ({
  tree,
  statusFilter,
  root,
  name,
  statistic,
  collapsedTrees,
  toggleTree,
  routeId,
  statsStore,
  navigateTo,
  treeFiltersStore,
}) => {
  const isEarlyCollapsed = collapsedTrees.has(tree.nodeId as string);
  const haveFailedSteps = statistic === undefined || !!statistic?.failed || !!statistic?.broken;
  const [isOpened, setIsOpen] = useState(() => (isEarlyCollapsed ? !haveFailedSteps : haveFailedSteps));

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
          statusFilter={statusFilter}
          collapsedTrees={collapsedTrees}
          toggleTree={toggleTree}
          routeId={routeId}
          navigateTo={navigateTo}
          statsStore={statsStore}
          treeFiltersStore={treeFiltersStore}
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
          treeFiltersStore={treeFiltersStore}
          statsStore={statsStore}
          categoryTitle={name}
          isOpened={isOpened}
          toggleTree={toggleTreeHeader}
          statistic={statistic}
        />
      )}
      {treeContent}
    </div>
  );
};
