import { ArrowButton, Counter, Text } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

interface MetadataButtonProps {
  isOpened?: boolean;
  setIsOpen: (isOpen: boolean) => void;
  counter?: number;
  title?: string;
}

export const MetadataButton: FunctionalComponent<MetadataButtonProps> = ({
  isOpened,
  setIsOpen,
  counter,
  title,
  ...rest
}) => {
  return (
    <button
      {...rest}
      className={clsx(styles["report-metadata-header"], isOpened && styles["report-metadata-header-opened"])}
      type={"button"}
      onClick={() => setIsOpen(!isOpened)}
    >
      <Text size={"m"} bold>
        {title}
      </Text>
      {!!counter && <Counter count={counter} size="s" />}
      <ArrowButton
        isOpened={isOpened}
        iconSize={"s"}
        buttonSize={"s"}
        className={styles["report-metadata-header-arrow"]}
        tag={"div"}
      />
    </button>
  );
};
