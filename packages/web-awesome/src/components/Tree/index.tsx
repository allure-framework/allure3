import type { RecursiveTree } from "@allurereport/web-components/global";
import { Button, Loadable, PageLoader, Text, Tree, TreeStatusBar } from "@allurereport/web-components";
import { useMemo } from "preact/hooks";
import { MetadataButton } from "@/components/MetadataButton";
import { reportStatsStore, statsByEnvStore } from "@/stores";
import { collapsedEnvironments, currentEnvironment, envDisplayNameMap, environmentsStore } from "@/stores/env";
import { useI18n } from "@/stores/locale";
import { navigateToTestResult } from "@/stores/router";
import { currentTrId } from "@/stores/testResult";
import { collapsedTrees, filteredTree, noTests, noTestsFound, toggleTree, treeStore } from "@/stores/tree";
import { clearTreeFilters, treeStatus } from "@/stores/treeFilters/store";
import { createTreeLocalizer } from "@/utils/tree";
import * as styles from "./styles.scss";

const treeNavigateTo = (id: string) => {
  navigateToTestResult({ testResultId: id });
};

export const TreeList = () => {
  const { t } = useI18n("empty");
  const { t: tEnvironments } = useI18n("environments");
  const { t: tooltip } = useI18n("transitions");
  const trId = currentTrId.value;

  const currentTreeStatus = treeStatus.value;

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
        if (environmentsStore.value.data?.length === 1) {
          const envKey = environmentsStore.value.data[0]?.id;
          const singleTree = envKey ? filteredTree.value[envKey] : undefined;
          const localizedTree = treeLocalizer(singleTree);
          if (localizedTree) {
            return (
              <div>
                <Tree
                  reportStatistic={reportStatsStore.value.data}
                  statistic={statsByEnvStore.value.data?.[currentEnvironment.value]}
                  collapsedTrees={collapsedTrees.value}
                  toggleTree={toggleTree}
                  navigateTo={treeNavigateTo}
                  tree={localizedTree}
                  statusFilter={currentTreeStatus}
                  routeId={trId}
                  root
                />
              </div>
            );
          }
        }

        const currentTree = currentEnvironment.value ? filteredTree.value[currentEnvironment.value] : undefined;
        const localizedCurrentTree = currentTree ? treeLocalizer(currentTree) : null;

        if (localizedCurrentTree) {
          return (
            <div>
              <Tree
                reportStatistic={reportStatsStore.value.data}
                statistic={statsByEnvStore.value.data?.[currentEnvironment.value]}
                collapsedTrees={collapsedTrees.value}
                toggleTree={toggleTree}
                navigateTo={treeNavigateTo}
                tree={localizedCurrentTree}
                statusFilter={currentTreeStatus}
                routeId={trId}
                root
              />
            </div>
          );
        }

        // render tree section for every environment (or empty when no trees)
        const entries = Object.entries(filteredTree.value ?? {});
        const validEntries: Array<[string, RecursiveTree]> = [];
        for (const [k, v] of entries) {
          if (v) {
            const localized = treeLocalizer(v);
            if (localized) validEntries.push([k, localized]);
          }
        }
        if (validEntries.length === 0) {
          return (
            <div>
              <div className={styles["tree-empty-results"]}>
                <Text className={styles["tree-empty-results-title"]}>{t("no-results")}</Text>
              </div>
            </div>
          );
        }
        return (
          <>
            {validEntries.map(([key, localizedValue]) => {
              const { total = 0 } = localizedValue.statistic ?? {};

              if (total === 0) {
                return null;
              }

              const isOpened = !collapsedEnvironments.value.includes(key);
              const toggleEnv = () => {
                collapsedEnvironments.value = isOpened
                  ? collapsedEnvironments.value.concat(key)
                  : collapsedEnvironments.value.filter((env) => env !== key);
              };
              const stats = statsByEnvStore.value.data?.[key];

              return (
                <div key={key} className={styles["tree-section"]} data-testid={"tree-section"}>
                  <div className={styles["tree-env-button"]}>
                    <MetadataButton
                      isOpened={isOpened}
                      setIsOpen={toggleEnv}
                      title={`${tEnvironments("environment", { count: 1 })}: "${envDisplayNameMap.value[key] ?? key}"`}
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
                        statistic={statsByEnvStore.value.data?.[key]}
                        reportStatistic={reportStatsStore.value.data}
                        collapsedTrees={collapsedTrees.value}
                        toggleTree={toggleTree}
                        statusFilter={currentTreeStatus}
                        navigateTo={treeNavigateTo}
                        tree={localizedValue}
                        routeId={trId}
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
