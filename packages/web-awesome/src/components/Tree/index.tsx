import { Button, Loadable, PageLoader, Text, Tree, TreeStatusBar } from "@allurereport/web-components";
import { useMemo } from "preact/hooks";
import type { AwesomeStatus } from "types";
import { MetadataButton } from "@/components/MetadataButton";
import { useTabsContext } from "@/components/Tabs";
import { reportStatsStore, statsByEnvStore } from "@/stores";
import { collapsedEnvironments, currentEnvironment, environmentsStore } from "@/stores/env";
import { useI18n } from "@/stores/locale";
import { navigateTo, route } from "@/stores/router";
import {
  clearTreeFilters,
  collapsedTrees,
  filteredTree,
  noTests,
  noTestsFound,
  toggleTree,
  treeStore,
} from "@/stores/tree";
import { createTreeLocalizer } from "@/utils/tree";
import * as styles from "./styles.scss";

export const TreeList = () => {
  const { t } = useI18n("empty");
  const { t: tEnvironments } = useI18n("environments");
  const { t: tooltip } = useI18n("transitions.description");
  const { currentTab } = useTabsContext();
  const routeId = route.value.params?.testResultId;

  const localizers = useMemo(
    () => ({
      tooltip,
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
          return (
            <div>
              <Tree
                reportStatistic={reportStatsStore.value.data}
                statistic={statsByEnvStore.value.data[currentEnvironment.value]}
                collapsedTrees={collapsedTrees.value}
                toggleTree={toggleTree}
                navigateTo={navigateTo}
                tree={treeLocalizer(filteredTree.value.default)}
                statusFilter={currentTab as AwesomeStatus}
                routeId={routeId}
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
                navigateTo={navigateTo}
                tree={treeLocalizer(currentTree)}
                statusFilter={currentTab as AwesomeStatus}
                routeId={routeId}
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

              return (
                <div key={key} className={styles["tree-section"]} data-testid={"tree-section"}>
                  <div className={styles["tree-env-button"]}>
                    <MetadataButton
                      isOpened={isOpened}
                      setIsOpen={toggleEnv}
                      title={`${tEnvironments("environment", { count: 1 })}: "${key}"`}
                      counter={total}
                      data-testid={"tree-section-env-button"}
                    />
                    <TreeStatusBar
                      statistic={stats}
                      reportStatistic={reportStatsStore.value.data}
                      statusFilter={currentTab}
                    />
                  </div>
                  {isOpened && (
                    <div data-testid={"tree-section-env-content"}>
                      <Tree
                        statistic={statsByEnvStore.value.data[key]}
                        reportStatistic={reportStatsStore.value.data}
                        collapsedTrees={collapsedTrees.value}
                        toggleTree={toggleTree}
                        statusFilter={currentTab}
                        navigateTo={navigateTo}
                        tree={treeLocalizer(value)}
                        routeId={routeId}
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
