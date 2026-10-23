import { environmentNameById } from "@allurereport/web-commons";
import { useEffect, useRef, useState } from "preact/hooks";

import { useElementTruncation } from "../../hooks/useElementTruncation";
import { DropdownButton } from "../Button";
import { Menu } from "../Menu";
import { SvgIcon, allureIcons } from "../SvgIcon";
import { TooltipWrapper } from "../Tooltip";
import { Text } from "../Typography";

import styles from "./styles.scss";

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

export type EnvironmentPickerProps = {
  "environments": { id: string; name: string }[];
  "value": string;
  "onChange": (value: string) => void;
  "labels": { environment: string; all: string };
  "data-testid"?: string;
};

export const EnvironmentPicker = ({
  environments,
  value,
  onChange,
  labels,
  "data-testid": testId,
}: EnvironmentPickerProps) => {
  const environmentId = value;
  const selectedEnvironmentLabel = environmentId ? environmentNameById(environments, environmentId) : labels.all;
  const { ref: selectedTextRef, isTruncated: isSelectedValueTruncated } = useElementTruncation<HTMLSpanElement>([
    selectedEnvironmentLabel,
  ]);

  if (environments.length <= 1) {
    return null;
  }

  return (
    <div className={styles["environment-picker"]} data-testid={testId}>
      <SvgIcon id={allureIcons.environment} size={"s"} />
      <Text className={styles["environment-picker-label"]} type={"ui"} size={"s"} bold>
        {labels.environment}:
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

          return (
            <TooltipWrapper
              tooltipText={selectedEnvironmentLabel}
              className={styles["environment-picker-trigger"]}
              triggerClassName={styles["environment-picker-trigger"]}
              isTriggerActive={!isOpened && isSelectedValueTruncated}
              data-testid="environment-picker-selected-tooltip"
            >
              {button}
            </TooltipWrapper>
          );
        }}
      >
        <Menu.Section>
          <Menu.ItemWithCheckmark
            data-testid={"environment-picker-item"}
            onClick={() => onChange("")}
            isChecked={!environmentId}
          >
            {labels.all}
          </Menu.ItemWithCheckmark>
          {environments.map((env) => (
            <Menu.ItemWithCheckmark
              data-testid={"environment-picker-item"}
              onClick={() => onChange(env.id)}
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
