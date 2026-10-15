import {
  Button,
  IconButton,
  Menu,
  SvgIcon,
  Text,
  TooltipWrapper,
  allureIcons,
  useElementTruncation,
} from "@allurereport/web-components";
import clsx from "clsx";
import { Fragment } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { ReportTestResult } from "types";

import { getCategoriesBreadcrumbs, revealCategoryNode } from "@/stores/categories";
import { revealTreeNode } from "@/stores/keyboard";
import { isSplitMode } from "@/stores/layout";
import { useI18n } from "@/stores/locale";
import { categoriesRoute, navigateToCategoriesRoot, navigateToRoot } from "@/stores/router";
import { getTreeBreadcrumbs } from "@/stores/tree";

import * as styles from "@/components/TestResult/TrHeader/styles.scss";

interface TrBreadcrumbs {
  testResult?: ReportTestResult;
}

const MAX_VISIBLE_BREADCRUMBS = 4;
const TRAILING_BREADCRUMBS = 2;
const HOVER_CLOSE_DELAY = 300;

// the wrappers of the tooltip stay in place for the labels that fit, so the layout doesn't change when a label starts to be truncated
const BreadcrumbButton = ({ text, onClick }: { text: string; onClick: () => void }) => {
  const { ref, isTruncated } = useElementTruncation<HTMLSpanElement>([text]);

  return (
    <TooltipWrapper
      tooltipText={text}
      placement={"bottom"}
      isTriggerActive={isTruncated}
      className={styles["test-result-breadcrumb-tooltip"]}
      triggerClassName={styles["test-result-breadcrumb-tooltip"]}
    >
      <Button
        type={"button"}
        size={"s"}
        style={"ghost"}
        text={text}
        textRef={ref}
        isTextTruncated
        className={styles["test-result-breadcrumb-button"]}
        data-testid={"test-result-breadcrumb-button"}
        onClick={onClick}
      />
    </TooltipWrapper>
  );
};

const BreadcrumbTitle = ({ text }: { text: string }) => {
  const { ref, isTruncated } = useElementTruncation<HTMLSpanElement>([text]);

  return (
    <TooltipWrapper
      tooltipText={text}
      placement={"bottom"}
      isTriggerActive={isTruncated}
      className={styles["test-result-breadcrumb-tooltip"]}
      triggerClassName={styles["test-result-breadcrumb-tooltip"]}
    >
      <span ref={ref} className={styles["test-result-breadcrumb-title"]}>
        <Text size={"s"} bold>
          {text}
        </Text>
      </span>
    </TooltipWrapper>
  );
};

export const TrBreadcrumbs = ({ testResult }: TrBreadcrumbs) => {
  const { t } = useI18n("ui");
  const closeTimer = useRef<number>();
  const setIsMenuOpenedRef = useRef<(isOpened: boolean) => void>();

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  };

  const openMenu = () => {
    clearCloseTimer();
    setIsMenuOpenedRef.current?.(true);
  };

  const scheduleMenuClose = () => {
    clearCloseTimer();

    closeTimer.current = window.setTimeout(() => {
      setIsMenuOpenedRef.current?.(false);
      closeTimer.current = undefined;
    }, HOVER_CLOSE_DELAY);
  };

  useEffect(() => clearCloseTimer, []);
  const { breadcrumbs, name, id } = testResult || {};
  const inCategories = categoriesRoute.value.matches;
  const treeBreadcrumbs = inCategories ? getCategoriesBreadcrumbs(id) : getTreeBreadcrumbs(id);
  const fallbackBreadcrumbs = treeBreadcrumbs.length ? [] : (breadcrumbs?.[0] ?? []);
  const navigateToTreeRoot = inCategories ? navigateToCategoriesRoot : navigateToRoot;

  const indexedBreadcrumbs = treeBreadcrumbs.map((breadcrumb, index) => ({ ...breadcrumb, index }));
  const isCollapsed = indexedBreadcrumbs.length > MAX_VISIBLE_BREADCRUMBS;
  const visibleBreadcrumbs = isCollapsed
    ? [indexedBreadcrumbs[0], ...indexedBreadcrumbs.slice(-TRAILING_BREADCRUMBS)]
    : indexedBreadcrumbs;
  const hiddenBreadcrumbs = isCollapsed ? indexedBreadcrumbs.slice(1, -TRAILING_BREADCRUMBS) : [];

  const navigateToGroup = (index: number) => {
    if (inCategories) {
      revealCategoryNode(treeBreadcrumbs.slice(0, index + 1).map((breadcrumb) => breadcrumb.nodeId));
    } else {
      revealTreeNode(treeBreadcrumbs[index].nodeId);
    }

    if (!isSplitMode.value) {
      navigateToTreeRoot();
    }
  };

  const breadcrumbArrow = (
    <SvgIcon id={allureIcons.lineArrowsChevronDown} className={styles["test-result-breadcrumb-arrow"]} />
  );

  return (
    <nav className={styles["test-result-breadcrumbs"]} aria-label={t("breadcrumbs")}>
      <div className={clsx(styles["test-result-breadcrumb"], styles["test-result-home"])}>
        <IconButton
          icon={allureIcons.lineGeneralHomeLine}
          size={"s"}
          style={"ghost"}
          className={styles["test-result-breadcrumb-link"]}
          onClick={() => navigateToTreeRoot()}
        />
      </div>
      {visibleBreadcrumbs.map(({ nodeId, name: groupName, index }, position) => (
        <Fragment key={nodeId}>
          <div className={styles["test-result-breadcrumb"]}>
            {breadcrumbArrow}
            <BreadcrumbButton text={groupName} onClick={() => navigateToGroup(index)} />
          </div>
          {isCollapsed && position === 0 && (
            <div className={clsx(styles["test-result-breadcrumb"], styles["test-result-breadcrumb-more"])}>
              {breadcrumbArrow}
              <Menu
                placement={"bottom-start"}
                menuTriggerWrapper={"span"}
                menuTrigger={({ onClick, isOpened, setIsOpened }) => {
                  setIsMenuOpenedRef.current = setIsOpened;

                  return (
                    <span onMouseEnter={openMenu} onMouseLeave={scheduleMenuClose}>
                      <Button
                        type={"button"}
                        size={"s"}
                        style={"ghost"}
                        text={"…"}
                        aria-label={t("breadcrumbs-hidden")}
                        className={styles["test-result-breadcrumb-button"]}
                        data-testid={"test-result-breadcrumb-more"}
                        isActive={isOpened}
                        onClick={onClick}
                      />
                    </span>
                  );
                }}
              >
                <div onMouseEnter={clearCloseTimer} onMouseLeave={scheduleMenuClose}>
                  <Menu.Section>
                    {hiddenBreadcrumbs.map((breadcrumb) => (
                      <Menu.Item
                        key={breadcrumb.nodeId}
                        dataTestId={"test-result-breadcrumb-hidden-item"}
                        onClick={() => navigateToGroup(breadcrumb.index)}
                      >
                        {breadcrumb.name}
                      </Menu.Item>
                    ))}
                  </Menu.Section>
                </div>
              </Menu>
            </div>
          )}
        </Fragment>
      ))}
      {fallbackBreadcrumbs.map((item, key) => (
        <div className={styles["test-result-breadcrumb"]} key={key}>
          {breadcrumbArrow}
          <BreadcrumbTitle text={item} />
        </div>
      ))}
      <div className={clsx(styles["test-result-breadcrumb"], styles["test-result-breadcrumb-name"])}>
        {name && breadcrumbArrow}
        {name && <BreadcrumbTitle text={name} />}
      </div>
    </nav>
  );
};
