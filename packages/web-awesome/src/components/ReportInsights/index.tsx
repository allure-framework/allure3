import { sanitizeExternalUrl } from "@allurereport/core-api";
import { Heading, SvgIcon, Text, allureIcons } from "@allurereport/web-components/core";
import clsx from "clsx";

import { reportStatsStore, statsByEnvStore } from "@/stores";
import { currentEnvironment } from "@/stores/env";
import { externalChecksStore } from "@/stores/externalChecks";
import { globalsStore } from "@/stores/globals";
import { isSplitMode } from "@/stores/layout";
import { useI18n } from "@/stores/locale";
import { metricRows, metricsStore } from "@/stores/metrics";
import { qualityGateStore } from "@/stores/qualityGate";
import { REPORT_ROOT_TAB } from "@/stores/reportRootTabs";

import * as styles from "./styles.scss";

type InsightTone = "success" | "danger" | "neutral";

type InsightMetric = ReturnType<typeof metricRows>[number];

const isRegressedMetric = ({ better, delta }: InsightMetric) => {
  if (delta === undefined || better === undefined) {
    return false;
  }

  return better === "lower" ? delta > 0 : delta < 0;
};

const getInsightStats = () => {
  const environment = currentEnvironment.value;

  return environment
    ? (statsByEnvStore.value.data[environment] ?? reportStatsStore.value.data)
    : reportStatsStore.value.data;
};

const getInsightMetrics = () => {
  const metrics = metricsStore.value.data ? metricRows(metricsStore.value.data) : [];

  return {
    metrics,
    regressedMetrics: metrics.filter(isRegressedMetric).length,
  };
};

const getInsightGlobalErrors = () => {
  const environment = currentEnvironment.value;
  const globals = globalsStore.value.data;

  return {
    globals,
    globalErrors: environment ? (globals?.errorsByEnv?.[environment] ?? []) : (globals?.errors ?? []),
  };
};

const getInsightQualityGates = () => {
  const environment = currentEnvironment.value;
  const qualityGateResults = qualityGateStore.value.data;
  const qualityGates = environment
    ? (qualityGateResults?.[environment] ?? [])
    : Object.values(qualityGateResults ?? {}).flatMap((results) => results);

  return {
    qualityGates,
    failedQualityGates: qualityGates.filter(({ success }) => !success),
  };
};

export const getFailedInsightsCount = () => {
  const stats = getInsightStats();
  const unsuccessfulTests = (stats.failed ?? 0) + (stats.broken ?? 0);
  const { metrics, regressedMetrics } = getInsightMetrics();
  const { globals, globalErrors } = getInsightGlobalErrors();
  const { qualityGates, failedQualityGates } = getInsightQualityGates();
  const failedExternalChecks = Object.values(externalChecksStore.value.data ?? {}).filter(
    ({ status }) => status === "failed",
  ).length;

  return (
    Number(stats.total > 0 && unsuccessfulTests > 0) +
    Number(metrics.length > 0 && regressedMetrics > 0) +
    Number(globals !== undefined && globalErrors.length > 0) +
    Number(qualityGates.length > 0 && failedQualityGates.length > 0) +
    failedExternalChecks
  );
};

type InsightCardProps = {
  icon: string;
  id: string;
  status: string;
  summary?: string;
  title: string;
  titleLink?: { external?: boolean; href: string };
  tone: InsightTone;
};

const InsightCard = ({ icon, id, status, summary, title, titleLink, tone }: InsightCardProps) => {
  return (
    <section className={clsx(styles.card, styles[`card-${tone}`])} data-testid={`insight-${id}`} data-tone={tone}>
      <div className={styles["card-header"]}>
        <span className={styles["card-icon"]}>
          <SvgIcon id={icon} size="m" />
        </span>
        <Heading tag="h2" size="s" className={styles["card-title"]}>
          {titleLink ? (
            <a
              href={titleLink.href}
              target={titleLink.external ? "_blank" : undefined}
              rel={titleLink.external ? "noopener noreferrer" : undefined}
              className={styles["card-title-link"]}
            >
              {title}
            </a>
          ) : (
            title
          )}
        </Heading>
        <Text tag="span" type="ui" size="s" bold className={styles["card-status"]}>
          {status}
        </Text>
      </div>
      {summary && (
        <Text tag="p" type="paragraph" size="m" className={styles["card-summary"]}>
          {summary}
        </Text>
      )}
    </section>
  );
};

export const ReportInsights = () => {
  const { t } = useI18n("ui");
  const stats = getInsightStats();
  const unsuccessfulTests = (stats.failed ?? 0) + (stats.broken ?? 0);
  const testsTone: InsightTone = stats.total === 0 ? "neutral" : unsuccessfulTests > 0 ? "danger" : "success";

  const { metrics, regressedMetrics } = getInsightMetrics();
  const metricsTone: InsightTone = metrics.length === 0 ? "neutral" : regressedMetrics > 0 ? "danger" : "success";

  const { globals, globalErrors } = getInsightGlobalErrors();
  const globalErrorsTone: InsightTone =
    globals === undefined ? "neutral" : globalErrors.length > 0 ? "danger" : "success";

  const { qualityGates, failedQualityGates } = getInsightQualityGates();
  const qualityGatesTone: InsightTone =
    qualityGates.length === 0 ? "neutral" : failedQualityGates.length > 0 ? "danger" : "success";

  const externalChecks = Object.values(externalChecksStore.value.data ?? {});
  const orderedExternalChecks = [
    ...externalChecks.filter(({ status }) => status === "failed"),
    ...externalChecks.filter(({ status }) => status === "passed"),
  ];

  const statusLabel = (tone: InsightTone) =>
    tone === "danger"
      ? t("insights.needsAttention")
      : tone === "success"
        ? t("insights.healthy")
        : t("insights.noData");

  return (
    <main
      className={clsx(styles.insights, isSplitMode.value && styles["insights-split"])}
      data-layout={isSplitMode.value ? "split" : "base"}
      data-testid="insights-view"
    >
      <div className={styles.grid}>
        <InsightCard
          id="tests"
          icon={allureIcons.lineGeneralChecklist3}
          title={t("insights.tests.title")}
          titleLink={{ href: `#${REPORT_ROOT_TAB.Results}` }}
          status={statusLabel(testsTone)}
          tone={testsTone}
          summary={
            unsuccessfulTests > 0
              ? t("insights.tests.summary", { unsuccessful: unsuccessfulTests, total: stats.total })
              : t("insights.tests.healthySummary", { total: stats.total })
          }
        />

        <InsightCard
          id="performance"
          icon={allureIcons.lineChartsBarChartSquare}
          title={t("insights.performance.title")}
          titleLink={{ href: "#metrics" }}
          status={statusLabel(metricsTone)}
          tone={metricsTone}
          summary={
            metrics.length === 0
              ? t("insights.performance.empty")
              : regressedMetrics > 0
                ? t("insights.performance.summary", { regressed: regressedMetrics, total: metrics.length })
                : t("insights.performance.healthySummary", { total: metrics.length })
          }
        />

        <InsightCard
          id="global-errors"
          icon={allureIcons.solidAlertCircle}
          title={t("insights.globalErrors.title")}
          titleLink={{ href: `#${REPORT_ROOT_TAB.GlobalErrors}` }}
          status={statusLabel(globalErrorsTone)}
          tone={globalErrorsTone}
          summary={
            globalErrors.length > 0
              ? t("insights.globalErrors.summary", { count: globalErrors.length })
              : t("insights.globalErrors.healthySummary")
          }
        />

        <InsightCard
          id="quality-gates"
          icon={allureIcons.lineHelpersFlag}
          title={t("insights.qualityGates.title")}
          titleLink={{ href: `#${REPORT_ROOT_TAB.QualityGate}` }}
          status={statusLabel(qualityGatesTone)}
          tone={qualityGatesTone}
          summary={
            qualityGates.length === 0
              ? t("insights.qualityGates.empty")
              : failedQualityGates.length > 0
                ? t("insights.qualityGates.summary", {
                    failed: failedQualityGates.length,
                    total: qualityGates.length,
                  })
                : t("insights.qualityGates.healthySummary", { total: qualityGates.length })
          }
        />

        {orderedExternalChecks.map((check) => {
          const tone = check.status === "failed" ? "danger" : "success";
          const sanitizedUrl = sanitizeExternalUrl(check.details?.url);
          const href = sanitizedUrl && /^https?:/.test(sanitizedUrl) ? sanitizedUrl : undefined;

          return (
            <InsightCard
              key={check.id}
              id={`external-check-${check.id}`}
              icon={check.status === "passed" ? allureIcons.lineGeneralCheckCircle : allureIcons.solidXCircle}
              title={check.name}
              status={t(`insights.externalChecks.${check.status}`)}
              tone={tone}
              summary={check.details?.error || check.details?.message || check.details?.command}
              titleLink={href ? { external: true, href } : undefined}
            />
          );
        })}
      </div>
    </main>
  );
};
