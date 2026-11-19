import { Loadable, Text, Widget } from "@allurereport/web-components/core";

import { environmentStore } from "@/stores/environment";
import { useI18n } from "@/stores/locale";

import * as styles from "../Overview.module.scss";

export const EnvironmentWidget = () => {
  const { t } = useI18n("overview");

  return (
    <div className={styles["overview-widget"]} data-testid="overview-environment">
      <Widget title={t("environment")}>
        <Loadable
          source={environmentStore}
          renderError={() => <Text className={styles["overview-empty"]}>{t("noEnvironment")}</Text>}
          renderData={(items) => {
            if (!items?.length) {
              return <Text className={styles["overview-empty"]}>{t("noEnvironment")}</Text>;
            }

            return (
              <table className={styles["overview-table"]}>
                <tbody>
                  {items.map(({ name, values }) => (
                    <tr key={name}>
                      <th scope="row">
                        <Text type="ui" size="m" bold>
                          {name}
                        </Text>
                      </th>
                      <td>
                        <Text type="ui" size="m">
                          {values.join(", ")}
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          }}
        />
      </Widget>
    </div>
  );
};
