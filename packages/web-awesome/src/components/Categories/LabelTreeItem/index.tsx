import type {
  CategoryNode,
  CategoryNodeProps,
  Statistic,
  TestStatus,
  TestStatusTransition,
} from "@allurereport/core-api";
import { capitalize } from "@allurereport/core-api";
import { SvgIcon, Text, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren } from "preact";
import type { FC } from "preact/compat";
import { GroupTreeItem } from "@/components/Categories/GroupTreeItem";
import { TrStatus } from "@/components/TestResult/TrStatus";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

type LabelTreeItemProps = CategoryNodeProps & {
  node: CategoryNode;
  isOpened: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  depth: number;
  subtreeToggle?: ComponentChildren;
  reportStatistic?: Statistic;
};

export const LabelTreeItem: FC<LabelTreeItemProps> = ({
  node,
  nodeId,
  store,
  isOpened,
  onToggle,
  children,
  depth,
  subtreeToggle,
  reportStatistic,
}) => {
  const { t: tTransitions } = useI18n("transitions");
  const { t: tEnvironments } = useI18n("environments");
  const { t: tFilters } = useI18n("filters");
  const { t: tEmpty } = useI18n("empty");
  const transitionIcons: Partial<Record<TestStatusTransition, string>> = {
    new: allureIcons.lineAlertsNew,
    fixed: allureIcons.lineAlertsFixed,
    regressed: allureIcons.lineAlertsRegressed,
    malfunctioned: allureIcons.lineAlertsMalfunctioned,
  };
  const keyLabels: Partial<Record<string, string>> = {
    owner: tFilters("owner"),
    layer: tFilters("layer"),
    severity: tFilters("severity"),
    status: tFilters("status"),
    transition: tFilters("transition"),
    flaky: tFilters("flaky"),
    environment: tEnvironments("environment", { count: 1 }),
  };
  const keyLabel = node.key ? (keyLabels[node.key] ?? node.key) : node.key;
  const emptyKeyByGroup: Partial<Record<string, string>> = {
    transition: "no-transition",
    layer: "no-layer",
    owner: "no-owner",
    severity: "no-severity",
    status: "no-status",
    environment: "no-environment",
    flaky: "no-flaky",
  };
  const emptyValueLabel = node.key ? tEmpty(emptyKeyByGroup[node.key] ?? "no-value") : tEmpty("no-value");
  const value = node.value === "<Empty>" ? emptyValueLabel : (node.value ?? "");
  const isStatusGroup = node.key === "status";
  const isTransitionGroup = node.key === "transition";
  const isFlakyGroup = node.key === "flaky";
  const statusLabelValue = node.value === "<Empty>" ? "unknown" : (node.value ?? "unknown");
  const statusValue = node.key === "status" ? (node.value ?? "") : "";
  const transitionValue = node.key === "transition" ? (node.value ?? "") : "";
  const statusIcon = statusValue && statusValue !== "<Empty>" ? (statusValue as TestStatus) : undefined;
  const transitionIcon =
    transitionValue && transitionValue !== "<Empty>"
      ? transitionIcons[transitionValue as TestStatusTransition]
      : undefined;
  const transitionLabel =
    transitionValue === "<Empty>"
      ? tEmpty("no-transition")
      : transitionValue
        ? (tTransitions(transitionValue) ?? transitionValue)
        : transitionValue;
  const isFlakyValue = node.value === true || node.value === "true";
  const flakyLabel =
    node.value === "<Empty>" ? tEmpty("no-flaky") : isFlakyValue ? tFilters("flaky") : tFilters("nonFlaky");
  const flakyIcon = isFlakyValue ? allureIcons.lineIconBomb2 : undefined;
  return (
    <GroupTreeItem
      node={node}
      nodeId={nodeId}
      store={store}
      isOpened={isOpened}
      onToggle={onToggle}
      depth={depth}
      subtreeToggle={subtreeToggle}
      reportStatistic={reportStatistic}
      className={clsx(
        styles["tree-item-label"],
        isStatusGroup && styles["tree-item-label-status"],
        isTransitionGroup && styles["tree-item-label-transition"],
        isFlakyGroup && styles["tree-item-label-flaky"],
      )}
      title={
        isStatusGroup ? (
          <div className={styles["tree-item-label-status-title"]}>
            <TrStatus status={statusLabelValue as TestStatus} />
          </div>
        ) : isTransitionGroup ? (
          <div className={styles["tree-item-label-transition-title"]}>
            {transitionIcon && <SvgIcon id={transitionIcon} className={styles["tree-item-label-transition-icon"]} />}
            <Text size="m" className={styles["tree-item-label-transition-text"]}>
              {capitalize(transitionLabel ?? "")}
            </Text>
          </div>
        ) : isFlakyGroup ? (
          <div className={styles["tree-item-label-flaky-title"]}>
            {flakyIcon && <SvgIcon id={flakyIcon} className={styles["tree-item-label-flaky-icon"]} />}
            <Text size="m" className={styles["tree-item-label-flaky-text"]}>
              {flakyLabel}
            </Text>
          </div>
        ) : (
          <div className={styles["tree-item-label-row"]}>
            <Text type={"ui"} size="m" className={styles["tree-item-label-key"]}>
              {keyLabel}
            </Text>
            <div className={styles["tree-item-label-values"]}>
              <div className={styles["tree-item-label-bubble"]}>
                {statusIcon ? (
                  <TreeItemIcon status={statusIcon} className={styles["tree-item-label-icon"]} />
                ) : transitionIcon ? (
                  <SvgIcon id={transitionIcon} className={styles["tree-item-label-transition-icon"]} />
                ) : null}
                <Text size="m" bold className={styles["tree-item-label-value-text"]}>
                  {value}
                </Text>
              </div>
            </div>
          </div>
        )
      }
    >
      {children}
    </GroupTreeItem>
  );
};
