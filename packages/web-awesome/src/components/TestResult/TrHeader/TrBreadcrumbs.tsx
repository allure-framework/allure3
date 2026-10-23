import {
  Button,
  IconButton,
  Menu,
  SvgIcon,
  Text,
  TooltipWrapper,
  allureIcons,
  useElementTruncation,
} from "@allurereport/web-components/core";
import clsx from "clsx";
import { useEffect, useRef, useState } from "preact/hooks";
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
// the widths the layout is calculated with: the home button, the shortest readable name of the test and a group with its arrow
const HOME_WIDTH = 32;
const MIN_NAME_WIDTH = 160;
const MIN_GROUP_WIDTH = 96;

// the width of the element, 0 until it's measured
const useElementWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => setWidth(element.clientWidth));

    observer.observe(element);
    setWidth(element.clientWidth);

    return () => observer.disconnect();
  }, []);

  return { ref, width };
};

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
  const { ref: navRef, width: navWidth } = useElementWidth<HTMLElement>();
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
  const groupsCount = indexedBreadcrumbs.length;
  // how many groups fit next to the name of the test, unlimited until the width is measured
  const fittingGroups = navWidth ? Math.floor((navWidth - HOME_WIDTH - MIN_NAME_WIDTH) / MIN_GROUP_WIDTH) : Infinity;
  const isCountCollapsed = groupsCount > MAX_VISIBLE_BREADCRUMBS;
  // the root and the levels above the test stay while they fit, otherwise only the closest levels are left
  const keepsRoot = fittingGroups >= 1 + TRAILING_BREADCRUMBS + 1;
  const isCollapsed = isCountCollapsed ? true : groupsCount > fittingGroups;
  const trailingCount = keepsRoot ? TRAILING_BREADCRUMBS : Math.max(fittingGroups - 1, 0);
  const leadingBreadcrumbs = isCollapsed && keepsRoot ? indexedBreadcrumbs.slice(0, 1) : [];
  const trailingBreadcrumbs = isCollapsed ? indexedBreadcrumbs.slice(groupsCount - trailingCount) : indexedBreadcrumbs;
  const hiddenBreadcrumbs = isCollapsed
    ? indexedBreadcrumbs.slice(leadingBreadcrumbs.length, groupsCount - trailingCount)
    : [];

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

  const moreMenu = (
    <div className={clsx(styles["test-result-breadcrumb"], styles["test-result-breadcrumb-more"])}>
      {breadcrumbArrow}
      <Menu
        size={"l"}
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
                <span className={styles["test-result-breadcrumb-hidden-item"]} title={breadcrumb.name}>
                  {breadcrumb.name}
                </span>
              </Menu.Item>
            ))}
          </Menu.Section>
        </div>
      </Menu>
    </div>
  );

  const renderGroup = ({ nodeId, name: groupName, index }: (typeof indexedBreadcrumbs)[number], isRoot = false) => (
    <div
      className={clsx(styles["test-result-breadcrumb"], isRoot && styles["test-result-breadcrumb-root"])}
      key={nodeId}
    >
      {breadcrumbArrow}
      <BreadcrumbButton text={groupName} onClick={() => navigateToGroup(index)} />
    </div>
  );

  return (
    <nav ref={navRef} className={styles["test-result-breadcrumbs"]} aria-label={t("breadcrumbs")}>
      <div className={clsx(styles["test-result-breadcrumb"], styles["test-result-home"])}>
        <IconButton
          icon={allureIcons.lineGeneralHomeLine}
          size={"s"}
          style={"ghost"}
          className={styles["test-result-breadcrumb-link"]}
          onClick={() => navigateToTreeRoot()}
        />
      </div>
      {leadingBreadcrumbs.map((breadcrumb) => renderGroup(breadcrumb, true))}
      {hiddenBreadcrumbs.length > 0 && moreMenu}
      {trailingBreadcrumbs.map((breadcrumb) => renderGroup(breadcrumb))}
      {fallbackBreadcrumbs.map((item, key) => (
        <div className={styles["test-result-breadcrumb"]} key={key}>
          {breadcrumbArrow}
          <BreadcrumbTitle text={Array.isArray(item) ? item.join("") : item} />
        </div>
      ))}
      <div className={clsx(styles["test-result-breadcrumb"], styles["test-result-breadcrumb-name"])}>
        {name && breadcrumbArrow}
        {name && <BreadcrumbTitle text={name} />}
      </div>
    </nav>
  );
};
