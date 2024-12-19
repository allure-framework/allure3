import { useEffect } from "preact/hooks";
import { useTabsContext } from "@/components/app/Tabs";
import Tree from "@/components/app/Tree/Tree";
import { Button } from "@/components/commons/Button";
import { Loadable } from "@/components/commons/Loadable";
import { PageLoader } from "@/components/commons/PageLoader";
import { Text } from "@/components/commons/Typography";
import { useI18n } from "@/stores/locale";
import { clearTreeFilters, filteredTree, noTests, noTestsFound, setTreeStatus, treeStore } from "@/stores/tree";
import type { AllureAwesomeStatus } from "../../../../types";
import * as styles from "./styles.scss";

export const TreeList = () => {
  const { t } = useI18n("empty");
  const { currentTab } = useTabsContext();

  useEffect(() => {
    setTreeStatus(currentTab as AllureAwesomeStatus);
  }, [currentTab]);

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
            <Tree tree={filteredTree.value} statusFilter={currentTab as AllureAwesomeStatus} root />
          </div>
        );
      }}
    />
  );
};
