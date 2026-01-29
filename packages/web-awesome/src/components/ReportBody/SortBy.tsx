import { DropdownButton, Link, Menu, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren } from "preact";
import { useI18n } from "@/stores/locale";
import { type SortByDirection, type SortByField, type SortBy as TSortBy, setSortBy, sortBy } from "@/stores/treeSort";
import * as styles from "./styles.scss";

const BtnWrapper = ({ children }: { children: ComponentChildren }) => {
  return <div className={styles.sortByBtnWrap}>{children}</div>;
};

const setSortByField = (value: SortByField) => {
  const direction = sortBy.peek().split(",")[1];
  setSortBy(`${value},${direction}` as TSortBy);
};

const setDirection = (value: SortByDirection) => {
  setSortBy(`${sortBy.peek().split(",")[0]},${value}` as TSortBy);
};

export const SortBy = () => {
  const { t: sortByLocale } = useI18n("sort-by");
  const { t: sortByValuesLocale } = useI18n("sort-by.values");
  const { t: sortByDirectionsLocale } = useI18n("sort-by.directions");
  const sortByValue = sortBy.value.split(",")[0] as SortByField;
  const direction = sortBy.value.split(",")[1] as SortByDirection;

  const displayedSortByValue = sortByValuesLocale(sortByValue === "name" ? "alphabet" : sortByValue);
  const displayedDirection = sortByDirectionsLocale(
    `${sortByValue === "name" ? "alphabet" : sortByValue}-${direction}-short`,
  );

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
                <Menu.ItemWithCheckmark onClick={() => setSortByField("order")} isChecked={sortByValue === "order"}>
                  {sortByValuesLocale("order")}
                </Menu.ItemWithCheckmark>
                <Menu.ItemWithCheckmark
                  onClick={() => setSortByField("duration")}
                  isChecked={sortByValue === "duration"}
                >
                  {sortByValuesLocale("duration")}
                </Menu.ItemWithCheckmark>
                <Menu.ItemWithCheckmark onClick={() => setSortByField("status")} isChecked={sortByValue === "status"}>
                  {sortByValuesLocale("status")}
                </Menu.ItemWithCheckmark>
                <Menu.ItemWithCheckmark onClick={() => setSortByField("name")} isChecked={sortByValue === "name"}>
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
                  onClick={() => setDirection("asc")}
                  leadingIcon={allureIcons.lineArrowsSortLineAsc}
                  isChecked={direction === "asc"}
                >
                  {sortByDirectionsLocale(`${sortByValue}-asc`)}
                </Menu.ItemWithCheckmark>
                <Menu.ItemWithCheckmark
                  onClick={() => setDirection("desc")}
                  leadingIcon={allureIcons.lineArrowsSortLineDesc}
                  isChecked={direction === "desc"}
                >
                  {sortByDirectionsLocale(`${sortByValue}-desc`)}
                </Menu.ItemWithCheckmark>
              </Menu.Section>
            </Menu>
          </Menu.Section>
        </Menu>
      </Text>
    </div>
  );
};
