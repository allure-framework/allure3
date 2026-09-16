import { Button, Loadable, PageLoader, Text } from "@allurereport/web-components";

import { VirtualTreeList } from "@/components/VirtualTree";
import { useI18n } from "@/stores/locale";
import { noTests, noTestsFound, treeStore } from "@/stores/tree";
import { clearTreeFilters } from "@/stores/treeFilters/store";

import * as styles from "./styles.scss";

export const TreeList = () => {
  const { t } = useI18n("empty");

  return (
    <Loadable
      source={treeStore}
      renderLoader={() => <PageLoader />}
      renderData={() => {
        if (noTests.value) {
          return (
            <div className={styles["tree-empty-results"]}>
              <Text className={styles["tree-empty-results-title"]}>{t("no-results")}</Text>
            </div>
          );
        }

        if (noTestsFound.value) {
          return (
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
          );
        }

        return <VirtualTreeList />;
      }}
    />
  );
};
