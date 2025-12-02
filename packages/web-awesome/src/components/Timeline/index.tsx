/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { TestResult } from "@allurereport/core-api";
import { Timeline as AllureTimeline, Grid, GridItem, Loadable, PageLoader, Widget } from "@allurereport/web-components";
import { computed } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";
import { useI18n } from "@/stores";
import { currentEnvironment } from "@/stores/env";
import { fetchTimelineData, timelineStore } from "@/stores/timeline";
import * as styles from "./styles.scss";

const getHosts = (tests: TestResult[]) => [
  ...new Set(tests.map((test) => test.labels.find((label) => label.name === "host")?.value).filter(Boolean)),
];

const filterTestsByHost = (tests: TestResult[], host: string) =>
  tests.filter((test) => test.labels.find((label) => label.name === "host")?.value === host);

const currentTimelineData = computed(() => {
  if (!timelineStore.value.data) {
    return [];
  }

  if (currentEnvironment.value) {
    const testsToEnv = timelineStore.value.data.filter((test) => test.environment === currentEnvironment.value);
    const hostsByEnv = getHosts(testsToEnv);

    return hostsByEnv.map((host) => ({
      data: filterTestsByHost(testsToEnv, host),
      host,
    }));
  }

  const hosts = getHosts(timelineStore.value.data);

  return hosts.map((host) => ({
    data: filterTestsByHost(timelineStore.value.data, host),
    host,
  }));
});

// Detects if the user prefers reduced motion to disable animations for accessibility
const prefersLessMovement = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const Timeline = () => {
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
        if (currentTimelineData.value.length === 0) {
          return (
            <div className={styles.overview}>
              <Grid kind="swap" className={styles["overview-grid"]}>
                <GridItem className={styles["overview-grid-item"]}>
                  <Widget>
                    <div className={styles.empty}>{t("empty")}</div>
                  </Widget>
                </GridItem>
              </Grid>
            </div>
          );
        }

        return (
          <div className={styles.overview}>
            <Grid kind="swap" className={styles["overview-grid"]}>
              {currentTimelineData.value.map(({ data, host }) => (
                <GridItem key={host} className={styles["overview-grid-item"]}>
                  <Widget title={t("host", { host })}>
                    {data.length > 0 && (
                      <AllureTimeline
                        data={data}
                        dataId={host}
                        width={100}
                        enableAnimations={!prefersLessMovement}
                        translations={translations}
                      />
                    )}
                    {data.length === 0 && <div className={styles.empty}>{t("empty_host", { host })}</div>}
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
