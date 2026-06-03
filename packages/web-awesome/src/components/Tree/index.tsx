import { scrollFocusIntoView, scrollTreePaneToTop } from "@allurereport/web-commons";
import { Button, Loadable, PageLoader, Text, Tree, TreeStatusBar } from "@allurereport/web-components";
import clsx from "clsx";
import { useLayoutEffect, useMemo } from "preact/hooks";

import { MetadataButton } from "@/components/MetadataButton";
import { reportStatsStore, statsByEnvStore } from "@/stores";
import { collapsedEnvironments, currentEnvironment, environmentNameById, environmentsStore } from "@/stores/env";
import { flatTree, getFlatTreeNode, setTreeFocusId, treeFocusId, treeScrollPaneToTopPending } from "@/stores/keyboard";
import { useI18n } from "@/stores/locale";
import { navigateToTestResult } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import {
  collapsedTrees,
  filteredTree,
  isTreeOpened,
  noTests,
  noTestsFound,
  toggleTree,
  treeStore,
} from "@/stores/tree";
import { clearTreeFilters, treeStatus } from "@/stores/treeFilters/store";
import { createTreeLocalizer } from "@/utils/tree";

import * as styles from "./styles.scss";

const treeNavigateTo = (testResultId: string) => {
  const flatNode = flatTree.value.find((node) => node.testResultId === testResultId || node.id === testResultId);

  setTreeFocusId(flatNode?.id ?? testResultId);
  navigateToTestResult({ testResultId });
};

export const TreeList = () => {
  const { t } = useI18n("empty");
  const { t: tEnvironments } = useI18n("environments");
  const { t: tooltip } = useI18n("transitions");
  const trId = currentTrId.value;
  const focusedId = treeFocusId.value;

  const currentTreeStatus = treeStatus.value;

  useLayoutEffect(() => {
    if (!focusedId) {
      return;
    }

    const node = document.querySelector(`[data-tree-node-id="${focusedId}"]`);

    if (!node) {
      return;
    }

    if (treeScrollPaneToTopPending.value) {
      treeScrollPaneToTopPending.value = false;
      scrollTreePaneToTop(node);
      return;
    }

    const flatNode = getFlatTreeNode(focusedId);
    const kind = flatNode?.kind;

    // For group/env nodes always pin to top (even when already visible in viewport)
    if (kind === "group" || kind === "env") {
      (node as HTMLElement).scrollIntoView({ block: "start", inline: "nearest" });
    } else {
      scrollFocusIntoView(node, { kind });
    }
  }, [focusedId]);

  useLayoutEffect(() => {
    if (!trId || focusedId) {
      return;
    }

    // Use flatTree to find the scoped node id — avoids duplicate id issues in multi-env trees
    const flatNode = flatTree.value.find((n) => n.testResultId === trId || n.id === trId);
    const node = flatNode
      ? (document.querySelector(`[data-tree-node-id="${flatNode.id}"]`) as HTMLElement | null)
      : document.getElementById(trId);

    if (!node) {
      return;
    }

    scrollFocusIntoView(node, { kind: "leaf" });
  }, [trId]);

  const localizers = useMemo(
    () => ({
      tooltip: (key: string, options: Record<string, string>) => tooltip(`description.${key}`, options),
    }),
    [tooltip],
  );

  return (
    <Loadable
      source={treeStore}
      renderLoader={() => <PageLoader />}
      renderData={() => {
        // TODO: use function instead of computed
        if (noTests.value) {
          return (
            <div>
              <div className={styles["tree-empty-results"]}>
                <Text className={styles["tree-empty-results-title"]}>{t("no-results")}</Text>
              </div>
            </div>
          );
        }

        if (noTestsFound.value) {
          return (
            <div>
              <div className={styles["tree-empty-results"]}>
                <Text tag="p" className={styles["tree-empty-results-title"]}>
                  {t("no-tests-found")}
                </Text>
                <Button
                  className={styles["tree-empty-results-clear-button"]}
                  type="button"
                  text={t("clear-filters")}
                  size={"s"}
                  style={"outline"}
                  onClick={() => clearTreeFilters()}
                />
              </div>
            </div>
          );
        }

        const treeLocalizer = createTreeLocalizer(localizers);

        // render single tree for single environment
        if (environmentsStore.value.data.length === 1) {
          const soleId = environmentsStore.value.data[0]!.id;
          const soleStatistic = currentEnvironment.value
            ? statsByEnvStore.value.data[currentEnvironment.value]
            : statsByEnvStore.value.data[soleId];

          return (
            <div>
              <Tree
                reportStatistic={reportStatsStore.value.data}
                statistic={soleStatistic}
                collapsedTrees={collapsedTrees.value}
                toggleTree={toggleTree}
                isGroupOpened={isTreeOpened}
                navigateTo={treeNavigateTo}
                tree={treeLocalizer(filteredTree.value[soleId])}
                statusFilter={currentTreeStatus}
                routeId={trId}
                focusedId={focusedId}
                root
              />
            </div>
          );
        }

        const currentTree = currentEnvironment.value ? filteredTree.value[currentEnvironment.value] : undefined;

        if (currentTree) {
          return (
            <div>
              <Tree
                reportStatistic={reportStatsStore.value.data}
                statistic={statsByEnvStore.value.data[currentEnvironment.value]}
                collapsedTrees={collapsedTrees.value}
                toggleTree={toggleTree}
                isGroupOpened={isTreeOpened}
                navigateTo={treeNavigateTo}
                tree={treeLocalizer(currentTree)}
                statusFilter={currentTreeStatus}
                routeId={trId}
                focusedId={focusedId}
                root
              />
            </div>
          );
        }

        // render tree section for every environment
        return (
          <>
            {Object.entries(filteredTree.value).map(([key, value]) => {
              const { total } = value.statistic;

              if (total === 0) {
                return null;
              }

              const isOpened = !collapsedEnvironments.value.includes(key);
              const toggleEnv = () => {
                collapsedEnvironments.value = isOpened
                  ? collapsedEnvironments.value.concat(key)
                  : collapsedEnvironments.value.filter((env) => env !== key);
              };
              const stats = statsByEnvStore.value.data[key];

              const envFocusId = `env:${key}`;

              return (
                <div key={key} className={styles["tree-section"]} data-testid={"tree-section"}>
                  <div
                    className={clsx(styles["tree-env-button"], focusedId === envFocusId && styles["tree-env-focused"])}
                    data-tree-node-id={envFocusId}
                    id={envFocusId}
                  >
                    <MetadataButton
                      isOpened={isOpened}
                      setIsOpen={toggleEnv}
                      title={`${tEnvironments("environment", { count: 1 })}: "${environmentNameById(key)}"`}
                      titleTooltipText={`${tEnvironments("environment", { count: 1 })}: "${environmentNameById(key)}"`}
                      truncateTitle
                      counter={total}
                      data-testid={"tree-section-env-button"}
                    />
                    <TreeStatusBar
                      statistic={stats}
                      reportStatistic={reportStatsStore.value.data}
                      statusFilter={currentTreeStatus}
                    />
                  </div>
                  {isOpened && (
                    <div data-testid={"tree-section-env-content"}>
                      <Tree
                        statistic={statsByEnvStore.value.data[key]}
                        reportStatistic={reportStatsStore.value.data}
                        collapsedTrees={collapsedTrees.value}
                        toggleTree={toggleTree}
                        isGroupOpened={isTreeOpened}
                        statusFilter={currentTreeStatus}
                        navigateTo={treeNavigateTo}
                        tree={treeLocalizer(value)}
                        routeId={trId}
                        focusedId={focusedId}
                        focusIdPrefix={`${key}:`}
                        root
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </>
        );
      }}
    />
  );
};
