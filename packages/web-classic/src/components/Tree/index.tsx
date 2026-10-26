import { Button, Loadable, PageLoader, Text } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import type { ReportStatus } from "types";

import Tree from "@/components/Tree/Tree";
import { useI18n } from "@/stores/locale";
import { currentTab, setCurrentTab } from "@/stores/tabs";

import { useTreeStore } from "./context";

import * as styles from "./styles.scss";

export { TreeStoreContext, useTreeStore } from "./context";

export const TreeList = () => {
  const { t } = useI18n("empty");
  const treeStore = useTreeStore();

  useEffect(() => {
    treeStore.setStatus(currentTab.value as ReportStatus);
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [currentTab.value, treeStore]);

  const clearFilters = () => {
    treeStore.clearFilters();
    setCurrentTab("total");
  };

  return (
    <Loadable
      source={treeStore.data}
      renderLoader={() => <PageLoader />}
      renderData={() => {
        if (treeStore.noTests.value) {
          return (
            <div className={styles["tree-list"]}>
              <div className={styles["tree-empty-results"]}>
                <Text className={styles["tree-empty-results-title"]}>{t("no-results")}</Text>
              </div>
            </div>
          );
        }

        if (treeStore.noTestsFound.value) {
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
                  onClick={clearFilters}
                />
              </div>
            </div>
          );
        }

        return (
          <div className={styles["tree-list"]}>
            <Tree
              key={treeStore.expansion.value.version}
              tree={treeStore.filtered.value}
              statusFilter={currentTab.value as ReportStatus}
              root
            />
          </div>
        );
      }}
    />
  );
};
