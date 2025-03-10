import { Button, Loadable, PageLoader, Text } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import type { AwesomeStatus } from "types";
import Tree from "@/components/Tree/Tree";
import {
  categoriesStore,
  clearCategoriesFilters,
  filteredCategories,
  noTests,
  noTestsFound,
  setCategoriesStatus,
} from "@/stores/categories";
import { useI18n } from "@/stores/locale";
import { currentTab } from "@/stores/tabs";
import * as styles from "./styles.scss";

export const CategoriesList = () => {
  const { t } = useI18n("empty");

  useEffect(() => {
    setCategoriesStatus(currentTab.value as AwesomeStatus);
  }, [currentTab.value]);

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
            <Tree tree={filteredCategories.value} statusFilter={currentTab.value as AwesomeStatus} root />
          </div>
        );
      }}
    />
  );
};
