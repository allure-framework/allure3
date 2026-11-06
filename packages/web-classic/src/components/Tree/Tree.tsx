import type { Statistic } from "@allurereport/core-api";
import cx from "clsx";
import type { FunctionComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ReportRecursiveTree, ReportStatus } from "types";

import TreeItem from "@/components/Tree/TreeItem";
import { route } from "@/stores/router";

import { useTreeStore } from "./context";
import TreeHeader from "./TreeHeader";

import * as styles from "./styles.scss";

interface TreeProps {
  statistic?: Statistic;
  tree: ReportRecursiveTree;
  name?: string;
  root?: boolean;
  statusFilter?: ReportStatus;
}

const Tree: FunctionComponent<TreeProps> = ({ tree, statusFilter, root, name, statistic }) => {
  const { params } = route.value;
  const { id: parentId, testResultId } = params;

  const { expansion } = useTreeStore();
  // a group opened by a link without a test result (e.g. from the Overview widgets) is marked and scrolled to
  const isMarked = !root && !testResultId && parentId === tree.nodeId;
  const ref = useRef<HTMLDivElement>(null);
  const [isOpened, setIsOpen] = useState(() => {
    const { mode } = expansion.peek();

    if (root || isMarked || mode === "expanded") {
      return true;
    }

    if (mode === "collapsed") {
      return false;
    }

    return parentId === tree.nodeId || statistic === undefined || !!statistic.failed || !!statistic.broken;
  });
  const toggleTree = () => {
    setIsOpen(!isOpened);
  };

  useEffect(() => {
    if (isMarked) {
      ref.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [isMarked]);
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
          flaky={leaf.flaky}
          retriesCount={leaf.retriesCount}
          transition={leaf.transition}
          parentNodeId={tree.nodeId}
          isMarked={leaf.nodeId === testResultId}
        />
      ))}
    </div>
  );

  return (
    <div className={styles.tree} ref={ref}>
      {name && (
        <TreeHeader
          categoryTitle={name}
          isOpened={isOpened}
          isMarked={isMarked}
          toggleTree={toggleTree}
          statistic={statistic}
        />
      )}
      {treeContent}
    </div>
  );
};

export default Tree;
