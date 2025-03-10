import type { Statistic } from "@allurereport/core-api";
import cx from "clsx";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeRecursiveTree, AwesomeStatus } from "types";
import TreeItem from "@/components/Tree/TreeItem";
import { route } from "@/stores/router";
import TreeHeader from "./TreeHeader";
import * as styles from "./styles.scss";

interface TreeProps {
  statistic?: Statistic;
  tree: AwesomeRecursiveTree;
  name?: string;
  root?: boolean;
  statusFilter?: AwesomeStatus;
}

const Tree: FunctionComponent<TreeProps> = ({ tree, statusFilter, root, name, statistic }) => {
  const { params } = route.value;
  const { id: parentId, testResultId } = params;

  const [isOpened, setIsOpen] = useState(
    parentId === tree.nodeId || statistic === undefined || !!statistic.failed || !!statistic.broken,
  );
  const toggleTree = () => {
    setIsOpen(!isOpened);
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
          parentNodeId={tree.nodeId}
          isMarked={leaf.nodeId === testResultId}
        />
      ))}
    </div>
  );

  return (
    <div className={styles.tree}>
      {name && <TreeHeader categoryTitle={name} isOpened={isOpened} toggleTree={toggleTree} statistic={statistic} />}
      {treeContent}
    </div>
  );
};

export default Tree;
