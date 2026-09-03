import { Code, IconButton, Menu, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { computed, useComputed } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { highlightAllUnder } from "prismjs";
import type { ReportTestResult } from "types";

import { useI18n } from "@/stores";
import { navigateToTestResult } from "@/stores/router";
import { trCurrentTab } from "@/stores/testResult";
import { testResultNavStore } from "@/stores/testResults";
import { copyToClipboard } from "@/utils/copyToClipboard";

import * as styles from "./styles.scss";

type Props = {
  testResult?: ReportTestResult;
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

const HOVER_CLOSE_DELAY = 300;

const FullName = (props: { fullName: string; testCaseId?: string; retryHash?: string }) => {
  const { fullName, testCaseId, retryHash } = props;
  const [copied, setCopied] = useState(false);
  const { t } = useI18n("ui");
  const closeTimer = useRef<number>();
  const copiedTimer = useRef<number>();
  const setIsOpenedRef = useRef<(isOpened: boolean) => void>();
  const clearCloseTimer = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  };
  const openMenu = (setIsOpened: (isOpened: boolean) => void) => {
    clearCloseTimer();
    setIsOpened(true);
  };
  const scheduleMenuClose = (setIsOpened = setIsOpenedRef.current) => {
    clearCloseTimer();

    closeTimer.current = window.setTimeout(() => {
      setIsOpened?.(false);
      closeTimer.current = undefined;
    }, HOVER_CLOSE_DELAY);
  };
  const clearCopiedTimer = () => {
    if (copiedTimer.current) {
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = undefined;
    }
  };
  const copyValue = (value: string) => {
    setCopied(true);
    copyToClipboard(value);

    copiedTimer.current = window.setTimeout(() => {
      setCopied(false);
    }, 750);
  };

  useEffect(() => {
    return () => {
      clearCloseTimer();
      clearCopiedTimer();
    };
  }, []);

  return (
    <div data-testid="test-result-fullname" className={styles.fullName}>
      <Menu
        size="s"
        placement="bottom-start"
        menuTriggerWrapper="span"
        menuTrigger={({ isOpened, onClick, setIsOpened }) => {
          setIsOpenedRef.current = setIsOpened;

          return (
            <span
              data-testid="test-result-fullname-copy-trigger"
              onMouseEnter={() => openMenu(setIsOpened)}
              onMouseLeave={() => scheduleMenuClose(setIsOpened)}
            >
              <IconButton
                aria-label={t("copy")}
                data-testid="test-result-fullname-copy"
                style="ghost"
                size="s"
                iconColor="secondary"
                icon={copied ? allureIcons.lineGeneralCheck : allureIcons.lineGeneralCopy3}
                isActive={isOpened}
                onClick={onClick}
              />
            </span>
          );
        }}
      >
        <div
          data-testid="test-result-copy-menu"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={() => scheduleMenuClose()}
        >
          <Menu.Section>
            <Menu.Item dataTestId="test-result-copy-fullname" onClick={() => copyValue(fullName)}>
              {t("fullname")}
            </Menu.Item>
            {testCaseId && (
              <Menu.Item dataTestId="test-result-copy-test-case-id" onClick={() => copyValue(testCaseId)}>
                {t("test-case-id")}
              </Menu.Item>
            )}
            {retryHash && (
              <Menu.Item dataTestId="test-result-copy-retry-hash" onClick={() => copyValue(retryHash)}>
                {t("retry-hash")}
              </Menu.Item>
            )}
          </Menu.Section>
        </div>
      </Menu>
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

  const isHidden = !!testResult?.isRetry;
  const hasFullName = !!testResult?.fullName;

  // Nothing to show
  if ((isHidden || !hasData.value) && !hasFullName) {
    return null;
  }

  return (
    <div className={styles.nav}>
      {hasFullName && (
        <FullName
          fullName={testResult.fullName}
          testCaseId={testResult.testCase?.id}
          retryHash={testResult.retryHash}
        />
      )}
      {!isHidden && <Controls currentId={testResult.id} />}
    </div>
  );
};
