import { DropdownButton, Link, Menu, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren } from "preact";
import { useI18n } from "@/stores/locale";
import { setTreeDirection, setTreeSortBy, treeFiltersStore } from "@/stores/tree";
import * as styles from "./styles.scss";

const BtnWrapper = ({ children }: { children: ComponentChildren }) => {
  return <div className={styles.sortByBtnWrap}>{children}</div>;
};

export const SortBy = () => {
  const { t: sortByLocale } = useI18n("sort-by");
  const { t: sortByValuesLocale } = useI18n("sort-by.values");
  const { t: sortByDirectionsLocale } = useI18n("sort-by.directions");
  const { sortBy, direction } = treeFiltersStore.value;

  const displayedSortByValue = sortByValuesLocale(sortBy);
  const displayedDirection = sortByDirectionsLocale(`${sortBy}-${direction}-short`);

  return (
    <div>
      <Text type="paragraph" size="m" className={styles.sortByText}>
        {sortByLocale("sort-by-text")}
        &nbsp;
        <Menu
          size="l"
          menuTriggerWrapper="span"
          menuTrigger={({ onClick, isOpened }) => (
            <Text type="paragraph" size="m">
              <Link onClick={onClick}>
                {displayedSortByValue} {displayedDirection}
                <SvgIcon
                  size="s"
                  id={allureIcons.lineArrowsChevronDown}
                  className={clsx(styles.sortByIcon, isOpened && styles.sortByIconReversed)}
                />
              </Link>
            </Text>
          )}
        >
          <Menu.Section>
            <Menu
              size="s"
              menuTrigger={({ onClick, isOpened }) => (
                <Menu.Item
                  closeMenuOnClick={false}
                  onClick={onClick}
                  leadingIcon={allureIcons.lineArrowsSwitchVertical1}
                  rightSlot={
                    <BtnWrapper>
                      <DropdownButton
                        style="outline"
                        size="s"
                        isExpanded={isOpened}
                        text={displayedSortByValue}
                        focusable={false}
                      />
                    </BtnWrapper>
                  }
                >
                  {sortByLocale("sort-by-category")}
                </Menu.Item>
              )}
            >
              <Menu.Section>
                <Menu.ItemWithCheckmark onClick={() => setTreeSortBy("order")} isChecked={sortBy === "order"}>
                  {sortByValuesLocale("order")}
                </Menu.ItemWithCheckmark>
                <Menu.ItemWithCheckmark onClick={() => setTreeSortBy("duration")} isChecked={sortBy === "duration"}>
                  {sortByValuesLocale("duration")}
                </Menu.ItemWithCheckmark>
                <Menu.ItemWithCheckmark onClick={() => setTreeSortBy("status")} isChecked={sortBy === "status"}>
                  {sortByValuesLocale("status")}
                </Menu.ItemWithCheckmark>
                <Menu.ItemWithCheckmark onClick={() => setTreeSortBy("alphabet")} isChecked={sortBy === "alphabet"}>
                  {sortByValuesLocale("alphabet")}
                </Menu.ItemWithCheckmark>
              </Menu.Section>
            </Menu>
            <Menu
              size="m"
              menuTrigger={({ onClick, isOpened }) => (
                <Menu.Item
                  closeMenuOnClick={false}
                  onClick={onClick}
                  leadingIcon={
                    direction === "asc" ? allureIcons.lineArrowsSortLineAsc : allureIcons.lineArrowsSortLineDesc
                  }
                  rightSlot={
                    <BtnWrapper>
                      <DropdownButton
                        style="outline"
                        size="s"
                        isExpanded={isOpened}
                        text={displayedDirection}
                        focusable={false}
                      />
                    </BtnWrapper>
                  }
                >
                  {sortByLocale("direction-category")}
                </Menu.Item>
              )}
            >
              <Menu.Section>
                <Menu.ItemWithCheckmark
                  onClick={() => setTreeDirection("asc")}
                  leadingIcon={allureIcons.lineArrowsSortLineAsc}
                  isChecked={direction === "asc"}
                >
                  {sortByDirectionsLocale(`${sortBy}-asc`)}
                </Menu.ItemWithCheckmark>
                <Menu.ItemWithCheckmark
                  onClick={() => setTreeDirection("desc")}
                  leadingIcon={allureIcons.lineArrowsSortLineDesc}
                  isChecked={direction === "desc"}
                >
                  {sortByDirectionsLocale(`${sortBy}-desc`)}
                </Menu.ItemWithCheckmark>
              </Menu.Section>
            </Menu>
          </Menu.Section>
        </Menu>
      </Text>
    </div>
  );
};
