import { Counter, Text } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import { ArrowButton } from "@/components/ArrowButton";
import * as styles from "./styles.scss";

interface MetadataButtonProps {
  isOpened?: boolean;
  setIsOpen: (isOpen: boolean) => void;
  counter?: number;
  title?: string;
}

export const MetadataButton: FunctionalComponent<MetadataButtonProps> = ({ isOpened, setIsOpen, counter, title }) => {
  return (
    <div
      className={clsx(styles["report-metadata-header"], isOpened && styles["report-metadata-header-opened"])}
      onClick={() => setIsOpen(!isOpened)}
    >
      <Text size={"m"} bold>
        {title}
      </Text>
      {counter && <Counter count={counter} size="s" />}
      <ArrowButton
        isOpened={isOpened}
        iconSize={"s"}
        buttonSize={"s"}
        className={styles["report-metadata-header-arrow"]}
      />
    </div>
  );
};
