import { Button, Loadable, PageLoader, Text, Tree } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import type { AwesomeStatus } from "types";
import { statsStore } from "@/stores";
import {
  categoriesStore,
  clearCategoriesFilters,
  fetchCategoriesData,
  filteredCategories,
  noTests,
  noTestsFound,
  setCategoriesStatus,
} from "@/stores/categories";
import { useI18n } from "@/stores/locale";
import { navigateTo, route } from "@/stores/router";
import { currentTab } from "@/stores/tabs";
import { collapsedTrees, toggleTree } from "@/stores/tree";
import { treeFiltersStore } from "@/stores/treeFilters";
import * as styles from "./styles.scss";

const Categories = () => {
  const { t } = useI18n("empty");
  const { id } = route.value;

  useEffect(() => {
    fetchCategoriesData();
  }, []);

  // useEffect(() => {
  //   setCategoriesStatus(currentTab.value as AwesomeStatus);
  // }, [currentTab.value]);

  return (
    <Loadable
      source={categoriesStore}
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
                  onClick={() => clearCategoriesFilters()}
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
              tree={filteredCategories.value}
              statusFilter={currentTab.value as AwesomeStatus}
              routeId={id}
              root
            />
          </div>
        );
      }}
    />
  );
};
export default Categories;
