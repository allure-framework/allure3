import { TreeStatusBar } from "@allurereport/web-components";

import { MetadataButton } from "@/components/MetadataButton";
import { reportStatsStore } from "@/stores";
import { collapsedEnvironments, environmentNameById } from "@/stores/env";
import { treeStatus } from "@/stores/treeFilters/store";
import type { VirtualEnvRow } from "@/stores/virtualTree";

import * as styles from "./styles.scss";

type Props = {
  row: VirtualEnvRow;
  focused: boolean;
  statusFilter: ReturnType<typeof treeStatus.peek>;
};

export const EnvHeader = ({ row, focused, statusFilter }: Props) => {
  const { id, nodeId, isExpanded, statistic } = row;
  const name = environmentNameById(nodeId);

  const handleToggle = () => {
    collapsedEnvironments.value = isExpanded
      ? collapsedEnvironments.value.concat(nodeId)
      : collapsedEnvironments.value.filter((e) => e !== nodeId);
  };

  return (
    <div
      className={`${styles["tree-env-button"]}${focused ? ` ${styles["tree-env-focused"]}` : ""}`}
      data-tree-node-id={id}
      id={id}
    >
      <MetadataButton
        isOpened={isExpanded}
        setIsOpen={handleToggle}
        title={name}
        titleTooltipText={name}
        truncateTitle
        counter={statistic?.total ?? 0}
        data-testid="tree-section-env-button"
      />
      <TreeStatusBar statistic={statistic} reportStatistic={reportStatsStore.value.data} statusFilter={statusFilter} />
    </div>
  );
};
