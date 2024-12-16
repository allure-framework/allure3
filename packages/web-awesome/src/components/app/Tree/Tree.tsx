import type { Statistic, TestStatus, WithChildren } from "@allurereport/core-api";
import cx from "clsx";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import { useReportContentContext } from "@/components/app/ReportBody/context";
import TreeItem from "@/components/app/Tree/TreeItem";
import { Loadable } from "@/components/commons/Loadable";
import { PageLoader } from "@/components/commons/PageLoader";
import { Text } from "@/components/commons/Typography";
import { useI18n } from "@/stores";
import { treeStore, filteredTree } from "@/stores/tree";
import { filterGroups, filterLeaves } from "@/utils/treeFilters";
import TreeHeader from "./TreeHeader";
import * as styles from "./styles.scss";

interface TreeProps {
  statistic?: Statistic;
  group: {
    // TODO: use proper types
    leaves: any[];
    groups: any[];
  };
  // leaves?: WithChildren["leaves"];
  // groups?: WithChildren["groups"];
  name?: string;
  root?: boolean;
  statusFilter?: TestStatus;
}

const Tree: FunctionComponent<TreeProps> = ({ group, statusFilter, root, name, statistic }) => {
  const [isOpened, setIsOpen] = useState(statistic === undefined || !!statistic.failed || !!statistic.broken);
  const { t } = useI18n("empty");

  // console.log("filtered tree", filteredTree.value)

  if (!group?.groups?.length && !group?.leaves?.length) {
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
      {group.groups.map((nestedGroup) => {
        // const group = treeData?.groupsById?.[groupId];

        // if (!group) {
        //   return null;
        // }

        return (
          <Tree
            key={nestedGroup.nodeId}
            name={nestedGroup.name}
            group={nestedGroup}
            statistic={nestedGroup.statistic}
            statusFilter={statusFilter}
          />
        );
      })}
      {group.leaves.map((leaf) => {
        // const leaf = treeData?.leavesById?.[leafId];
        //
        // if (!leaf) {
        //   return null;
        // }

        return (
          <TreeItem
            data-testid="tree-leaf"
            key={leaf.nodeId}
            id={leaf.nodeId}
            name={leaf.name}
            status={leaf.status}
            order={leaf.order}
            duration={leaf.duration}
          />
        );
      })}
    </div>
  );

  return (
    <div className={styles.tree}>
      {name && (
        <TreeHeader
          categoryTitle={name}
          isOpened={isOpened}
          // toggleTree={toggleTree}
          toggleTree={() => {}}
          statistic={statistic}
          data-testid="tree-group-header"
        />
      )}
      {treeContent}
    </div>
  );

  // return (
  //   <Loadable
  //     source={treeStore}
  //     renderLoader={() => <PageLoader />}
  //     renderData={(treeData) => {
  //       // const reportContext = useReportContentContext();
  //       const toggleTree = () => {
  //         setIsOpen(!isOpened);
  //       };
  //       // const leavesToRender = filterLeaves(leaves, treeData?.leavesById, statusFilter, reportContext);
  //       // const groupsToRender = filterGroups(
  //       //   groups,
  //       //   treeData?.groupsById,
  //       //   treeData?.leavesById,
  //       //   statusFilter,
  //       //   reportContext,
  //       // );
  //
  //
  //     }}
  //   />
  // );
};

export default Tree;
