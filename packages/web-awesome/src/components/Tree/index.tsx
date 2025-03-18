import { Button, Loadable, PageLoader, Text, Tree } from "@allurereport/web-components";
import type { AwesomeStatus } from "types";
import { MetadataButton } from "@/components/MetadataButton";
import { useTabsContext } from "@/components/Tabs";
import { statsStore } from "@/stores";
import { collapsedEnvironments, currentEnvironment, environmentsStore } from "@/stores/env";
import { useI18n } from "@/stores/locale";
import { navigateTo } from "@/stores/router";
import {
  clearTreeFilters,
  collapsedTrees,
  filteredTree,
  noTests,
  noTestsFound,
  toggleTree,
  treeFiltersStore,
  treeStore,
} from "@/stores/tree";
import * as styles from "./styles.scss";

export const TreeList = () => {
  const { t } = useI18n("empty");
  const { currentTab } = useTabsContext();

  return (
    <Loadable
      source={treeStore}
      renderLoader={() => <PageLoader />}
      renderData={() => {
        // TODO: use function instead of computed
        if (noTests.value) {
          return (
            <div className={styles["tree-list"]}>
              <div className={styles["tree-empty-results"]}>
                <Text className={styles["tree-empty-results-title"]}>{t("no-results")}</Text>
              </div>
            </div>
          );
        }

        if (noTestsFound.value) {
          return (
            <div className={styles["tree-list"]}>
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

        // render single tree for single environment
        if (environmentsStore.value.data.length === 1) {
          return (
            <div className={styles["tree-list"]}>
              <Tree
                collapsedTrees={collapsedTrees.value}
                toggleTree={toggleTree}
                treeFiltersStore={treeFiltersStore}
                navigateTo={navigateTo}
                statsStore={statsStore}
                tree={filteredTree.value.default}
                statusFilter={currentTab as AwesomeStatus}
                root
              />
            </div>
          );
        }

        const currentTree = currentEnvironment.value ? filteredTree.value[currentEnvironment.value] : undefined;

        if (currentTree) {
          return (
            <div className={styles["tree-list"]}>
              <Tree
                collapsedTrees={collapsedTrees.value}
                toggleTree={toggleTree}
                treeFiltersStore={treeFiltersStore}
                navigateTo={navigateTo}
                statsStore={statsStore}
                tree={currentTree}
                statusFilter={currentTab as AwesomeStatus}
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

              return (
                <div key={key} className={styles["tree-section"]}>
                  <MetadataButton
                    isOpened={isOpened}
                    setIsOpen={toggleEnv}
                    title={`Environment: "${key}"`}
                    counter={total}
                  />
                  {isOpened && (
                    <div className={styles["tree-list"]}>
                      <Tree
                        collapsedTrees={collapsedTrees.value}
                        toggleTree={toggleTree}
                        treeFiltersStore={treeFiltersStore}
                        navigateTo={navigateTo}
                        statsStore={statsStore}
                        tree={value}
                        statusFilter={currentTab as AwesomeStatus}
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
