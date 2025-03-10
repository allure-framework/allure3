import { Button, Loadable, PageLoader, Text } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import type { AwesomeStatus } from "types";
import Tree from "@/components/Tree/Tree";
import {
  behaviorsStore,
  clearBehaviorsFilters,
  filteredBehaviors,
  noTests,
  noTestsFound,
  setBehaviorsStatus,
} from "@/stores/behaviors";
import { useI18n } from "@/stores/locale";
import { currentTab } from "@/stores/tabs";
import * as styles from "./styles.scss";

export const BehaviorsList = () => {
  const { t } = useI18n("empty");

  useEffect(() => {
    setBehaviorsStatus(currentTab.value as AwesomeStatus);
  }, [currentTab.value]);

  return (
    <Loadable
      source={behaviorsStore}
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
                  onClick={() => clearBehaviorsFilters()}
                />
              </div>
            </div>
          );
        }

        return (
          <div className={styles["tree-list"]}>
            <Tree tree={filteredBehaviors.value} statusFilter={currentTab.value as AwesomeStatus} root />
          </div>
        );
      }}
    />
  );
};
