import type { Statistic } from "@allurereport/core-api";
import cx from "clsx";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import type { AllureAwesomeRecursiveTree, AllureAwesomeStatus } from "types";
import TreeItem from "@/components/Tree/TreeItem";
import { route } from "@/stores/router";
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
  const {
    params: { id, subId },
  } = route.value;
  const [isOpened, setIsOpen] = useState(root || false);
  const toggleTree = () => {
    setIsOpen(!isOpened);
  };
  // const emptyTree = !tree?.trees?.length && !tree?.leaves?.length;

  // if (emptyTree) {
  //   return null;
  // }

  const treeContent = isOpened && (
    <div
      data-testid="tree-content"
      className={cx({
        [styles["tree-content"]]: true,
        [styles.root]: root,
      })}
    >
      {tree?.children?.map?.((leaf, key) => {
        if (leaf.children?.length) {
          return (
            <Tree
              key={leaf.nodeId}
              name={leaf.name}
              tree={leaf}
              statistic={leaf.statistic}
              statusFilter={statusFilter}
            />
          );
        }

        return (
          <TreeItem
            data-testid="tree-leaf"
            key={leaf.nodeId}
            uid={leaf.uid}
            time={leaf.time}
            parentUid={leaf.parentUid}
            name={leaf.name}
            status={leaf.status}
            groupOrder={leaf.groupOrder || key + 1}
            duration={leaf.duration}
            marked={subId === leaf.uid}
          />
        );
      })}
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
