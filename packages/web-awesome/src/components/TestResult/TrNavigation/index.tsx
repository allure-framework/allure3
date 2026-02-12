import { Code, IconButton, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { computed, useComputed } from "@preact/signals";
import type { AwesomeTestResult } from "types";
import { useI18n } from "@/stores";
import { navigateToTestResult } from "@/stores/router";
import { trCurrentTab } from "@/stores/testResult";
import { testResultNavStore } from "@/stores/testResults";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

type Props = {
  testResult?: AwesomeTestResult;
};

const NavArrow = (props: { trId: string | undefined; type: "prev" | "next" }) => {
  const { trId, type } = props;

  const { t: tooltipT } = useI18n("controls");
  const isDisabled = trId === undefined;
  const isPrevArrow = type === "prev";

  const icon = isPrevArrow ? allureIcons.lineArrowsChevronUp : allureIcons.lineArrowsChevronDown;

  const prevTooltip = tooltipT("prevTR");
  const nextTooltip = tooltipT("nextTR");
  const testId = `test-result-nav-${type}`;

  if (isDisabled) {
    return <IconButton icon={icon} style="ghost" isDisabled data-testid={testId} />;
  }

  return (
    <TooltipWrapper tooltipText={isPrevArrow ? prevTooltip : nextTooltip}>
      <IconButton
        icon={icon}
        style="ghost"
        data-testid={testId}
        onClick={() => navigateToTestResult({ testResultId: trId, tab: trCurrentTab.value })}
      />
    </TooltipWrapper>
  );
};

const FullName = (props: { fullName: string }) => {
  const { fullName } = props;
  const { t: tooltipT } = useI18n("controls");

  return (
    <div data-testid="test-result-fullname" className={styles.fullName}>
      <TooltipWrapper tooltipText={tooltipT("clipboard")} tooltipTextAfterClick={tooltipT("clipboardSuccess")}>
        <IconButton
          data-testid="test-result-fullname-copy"
          style="ghost"
          size="s"
          iconColor="secondary"
          icon={allureIcons.lineGeneralCopy3}
          onClick={() => copyToClipboard(fullName)}
        />
      </TooltipWrapper>
      <Code tag="div" size="s" className={styles.text}>
        {fullName}
      </Code>
    </div>
  );
};

const Counter = (props: { current: number; total: number }) => {
  const { current, total } = props;

  return (
    <Code data-testid="test-result-nav-current" size="s" className={styles.counter}>
      {current}&#47;{total}
    </Code>
  );
};

const trData = computed(() => testResultNavStore.value.data ?? []);
const hasData = computed(() => trData.value.length > 0);

const Controls = (props: { currentId: string }) => {
  const { currentId } = props;

  const nextTrId = useComputed<string | undefined>(() => trData.value[trData.value.indexOf(currentId) + 1]);
  const prevTrId = useComputed<string | undefined>(() => trData.value[trData.value.indexOf(currentId) - 1]);
  const currentIndex = useComputed(() => trData.value.indexOf(currentId) + 1);
  const total = useComputed(() => trData.value.length);

  if (!hasData.value) {
    return null;
  }

  return (
    <div className={styles.controls}>
      <NavArrow trId={prevTrId.value} type="prev" />
      <Counter current={currentIndex.value} total={total.value} />
      <NavArrow trId={nextTrId.value} type="next" />
    </div>
  );
};

export const TrNavigation = (props: Props) => {
  const { testResult } = props;

  if (!testResult?.id) {
    return null;
  }

  const isHidden = !!testResult?.hidden;
  const hasFullName = !!testResult?.fullName;

  // Nothing to show
  if ((isHidden || !hasData.value) && !hasFullName) {
    return null;
  }

  return (
    <div className={styles.nav}>
      {hasFullName && <FullName fullName={testResult.fullName} />}
      {!isHidden && <Controls currentId={testResult.id} />}
    </div>
  );
};
