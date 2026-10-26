import type { ReportStatus } from "@allurereport/plugin-api";
import { Loadable, Text, TreeStatusBar, Widget } from "@allurereport/web-components/core";
import type { Signal } from "@preact/signals";
import type { ReportTree } from "types";

import { useI18n } from "@/stores/locale";
import type { StoreSignalState } from "@/stores/types";
import { createTreeWidgetData } from "@/utils/overview";

import * as styles from "../Overview.module.scss";

type TreeWidgetProps = {
  title: string;
  source: Signal<StoreSignalState<ReportTree>>;
  // the tab of the report that shows the whole tree
  tabName: string;
  testId: string;
};

const statusFilter: ReportStatus = "total";

/**
 * The Allure 2 widget with the top level groups of a tree and their status bars,
 * used for suites, features by stories and categories
 */
export const TreeWidget = ({ title, source, tabName, testId }: TreeWidgetProps) => {
  const { t } = useI18n("overview");

  return (
    <div className={styles["overview-widget"]} data-testid={testId}>
      <Widget title={title}>
        <Loadable
          source={source}
          renderError={() => <Text className={styles["overview-empty"]}>{t("noItems")}</Text>}
          renderData={(tree) => {
            const { items, total } = createTreeWidgetData(tree);
            const maxStatistic = items.reduce((acc, { statistic }) => (statistic.total > acc.total ? statistic : acc), {
              total: 0,
            });

            return (
              <div className={styles["overview-tree-widget"]}>
                <Text type="ui" size="s" className={styles["overview-secondary"]}>
                  {t("itemsTotal", { count: total })}
                </Text>
                {items.length === 0 ? (
                  <Text className={styles["overview-empty"]}>{t("noItems")}</Text>
                ) : (
                  <ul className={styles["overview-tree-widget-list"]}>
                    {items.map(({ id, name, statistic }) => (
                      <li key={id} className={styles["overview-tree-widget-item"]}>
                        <Text className={styles["overview-tree-widget-name"]} title={name}>
                          {name}
                        </Text>
                        <TreeStatusBar
                          statistic={statistic}
                          reportStatistic={maxStatistic}
                          statusFilter={statusFilter}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <a className={styles["overview-show-all"]} href={`#${tabName}`}>
                  <Text type="ui" size="s" bold>
                    {t("showAll")}
                  </Text>
                </a>
              </div>
            );
          }}
        />
      </Widget>
    </div>
  );
};
