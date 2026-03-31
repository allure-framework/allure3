import {
  DropdownButton,
  Menu,
  SvgIcon,
  Text,
  TooltipWrapper,
  allureIcons,
  useElementTruncation,
} from "@allurereport/web-components";
import { useEffect, useRef, useState } from "preact/hooks";

import { useI18n } from "@/stores";
import { currentEnvironment, environmentNameById, environmentsStore, setCurrentEnvironment } from "@/stores/env";

import * as styles from "./styles.scss";

const isOverflowing = (element: HTMLElement) => element.scrollWidth > element.clientWidth;

const EnvironmentMenuItemText = ({ value }: { value: string }) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;

    if (!element) {
      return;
    }

    setIsTruncated(isOverflowing(element));
  }, [value]);

  const textNode = (
    <span ref={textRef} className={styles["environment-picker-item-text"]}>
      {value}
    </span>
  );

  if (!isTruncated) {
    return textNode;
  }

  return <TooltipWrapper tooltipText={value}>{textNode}</TooltipWrapper>;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export const EnvironmentPicker = () => {
  const { t } = useI18n("environments");
  const environmentId = currentEnvironment.value;
  const selectedEnvironmentLabel = environmentId ? environmentNameById(environmentId) : t("all");
  const { ref: selectedTextRef, isTruncated: isSelectedValueTruncated } = useElementTruncation<HTMLSpanElement>([
    selectedEnvironmentLabel,
  ]);

  const handleSelect = (selectedOption: string) => {
    setCurrentEnvironment(selectedOption);
  };

  // TODO: use props instead
  if (environmentsStore.value.data.length <= 1) {
    return null;
  }

  return (
    <div className={styles["environment-picker"]} data-testid={"environment-picker"}>
      <SvgIcon id={allureIcons.environment} size={"s"} />
      <Text className={styles["environment-picker-label"]} type={"ui"} size={"s"} bold>
        {t("environment", { count: 1 })}:
      </Text>
      <Menu
        size="s"
        menuTrigger={({ isOpened, onClick }) => {
          const button = (
            <DropdownButton
              style="ghost"
              size="s"
              text={selectedEnvironmentLabel}
              textRef={selectedTextRef}
              isExpanded={isOpened}
              isTextTruncated
              className={styles["environment-picker-button"]}
              data-testid={"environment-picker-button"}
              onClick={onClick}
            />
          );

          if (isOpened || !isSelectedValueTruncated) {
            return button;
          }

          return (
            <TooltipWrapper tooltipText={selectedEnvironmentLabel} data-testid="environment-picker-selected-tooltip">
              {button}
            </TooltipWrapper>
          );
        }}
      >
        <Menu.Section>
          <Menu.ItemWithCheckmark
            data-testid={"environment-picker-item"}
            onClick={() => handleSelect("")}
            isChecked={!environmentId}
          >
            {t("all")}
          </Menu.ItemWithCheckmark>
          {environmentsStore.value.data.map((env) => (
            <Menu.ItemWithCheckmark
              data-testid={"environment-picker-item"}
              onClick={() => handleSelect(env.id)}
              key={env.id}
              isChecked={env.id === environmentId}
            >
              <EnvironmentMenuItemText value={env.name} />
            </Menu.ItemWithCheckmark>
          ))}
        </Menu.Section>
      </Menu>
    </div>
  );
};
