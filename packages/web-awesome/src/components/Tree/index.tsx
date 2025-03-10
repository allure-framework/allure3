import { Button, Loadable, PageLoader, Text, Tree } from "@allurereport/web-components";
import type { AwesomeStatus } from "types";
import { useTabsContext } from "@/components/Tabs";
import { statsStore } from "@/stores";
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

        return (
          <div className={styles["tree-list"]}>
            <Tree
              collapsedTrees={collapsedTrees.value}
              toggleTree={toggleTree}
              treeFiltersStore={treeFiltersStore}
              navigateTo={navigateTo}
              statsStore={statsStore}
              tree={filteredTree.value}
              statusFilter={currentTab as AwesomeStatus}
              root
            />
          </div>
        );
      }}
    />
  );
};
