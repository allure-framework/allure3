import { Button, Loadable, PageLoader, Text } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import type { AwesomeStatus } from "types";
import Tree from "@/components/Tree/Tree";
import { useI18n } from "@/stores/locale";
import { currentTab } from "@/stores/tabs";
import { clearTreeFilters, filteredTree, noTests, noTestsFound, setTreeStatus, treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

export const TreeList = () => {
  const { t } = useI18n("empty");

  useEffect(() => {
    setTreeStatus(currentTab.value as AwesomeStatus);
  }, [currentTab.value]);

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
            <Tree tree={filteredTree.value} statusFilter={currentTab.value as AwesomeStatus} root />
          </div>
        );
      }}
    />
  );
};
