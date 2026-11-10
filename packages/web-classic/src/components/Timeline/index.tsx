import { Loadable, PageLoader, Widget } from "@allurereport/web-components/core";
import { Grid, GridItem } from "@allurereport/web-components/Grid";
import { Timeline as AllureTimeline } from "@allurereport/web-components/Timeline";
import { computed } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";

import { useI18n } from "@/stores";
import { fetchTimelineData, groupTimelineByHost, timelineStore } from "@/stores/timeline";
import { navigateTo } from "@/utils/navigate";

import * as styles from "./styles.scss";

// Classic charts sit next to the side nav, so keep duration labels like "13s 968ms" from overlapping
const MIN_TICK_SPACING = 100;

const timelineByHost = computed(() => groupTimelineByHost(timelineStore.value.data));

const Timeline = () => {
  const { t } = useI18n("timeline");

  useEffect(() => {
    fetchTimelineData();
  }, []);

  const translations = useMemo(
    () => ({
      empty: t("empty"),
      selected: (props: { count: number; percentage: string; minDuration: string; maxDuration: string }) =>
        t("selected", {
          count: props.count,
          percentage: props.percentage,
          minDuration: props.minDuration,
          maxDuration: props.maxDuration,
        }),
    }),
    [t],
  );

  return (
    <Loadable
      source={timelineStore}
      renderLoader={() => <PageLoader />}
      renderData={() => {
        const groups = timelineByHost.value;

        return (
          <div className={styles.timeline} data-testid="timeline">
            <Grid kind="swap" className={styles["timeline-grid"]}>
              {groups.length === 0 && (
                <GridItem className={styles["timeline-grid-item"]}>
                  <Widget>
                    <div className={styles.empty}>{t("empty")}</div>
                  </Widget>
                </GridItem>
              )}
              {groups.map(({ data, host }) => (
                <GridItem key={host} className={styles["timeline-grid-item"]}>
                  <Widget title={t("host", { host })}>
                    <AllureTimeline
                      data={data}
                      dataId={host}
                      width={100}
                      minTickSpacing={MIN_TICK_SPACING}
                      translations={translations}
                      onTestResultClick={(testResultId) => navigateTo(`testresult/${testResultId}`)}
                    />
                  </Widget>
                </GridItem>
              ))}
            </Grid>
          </div>
        );
      }}
    />
  );
};

export default Timeline;
