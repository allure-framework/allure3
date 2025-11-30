import type { Statistic } from "@allurereport/core-api";
import IconLabel from "@/components/IconLabel";
import { allureIcons } from "@/components/SvgIcon";
import { ADD_STATS_KEYS } from "./constants";
import styles from "./styles.scss";
import type { I18nProp } from "./types";

type Props = { stats: Statistic; i18n: I18nProp; layout: "vertical" | "horizontal" };

const trimValue = (value: number) => {
  if (value > 1000) {
    return "999+";
  }

  return value.toString();
};

const getIcon = (key: (typeof ADD_STATS_KEYS)[number]) => {
  switch (key) {
    case "new":
      return allureIcons.testNew;
    case "flaky":
      return allureIcons.lineIconBomb2;
    case "retries":
      return allureIcons.lineGeneralZap;
  }
};

export const AdditionalStats = (props: Props) => {
  const { stats, i18n, layout } = props;

  return (
    <div className={styles.additionalStats} data-layout={layout}>
      {ADD_STATS_KEYS.map((key) => {
        const value = stats[key] ?? 0;

        return (
          <IconLabel key={key} style="primary" tooltip={i18n(`tests.${key}`, { count: value })} icon={getIcon(key)}>
            {value ? trimValue(value) : "-"}
          </IconLabel>
        );
      })}
    </div>
  );
};
