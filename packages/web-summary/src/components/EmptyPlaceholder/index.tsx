import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export type EmptyPlaceholderProps = {
  label: string;
};

export const EmptyPlaceholder: FunctionalComponent<EmptyPlaceholderProps> = ({ label }) => {
  return (
    <div className={styles["empty-placeholder"]}>
      <div className={styles["empty-placeholder-wrapper"]}>
        <SvgIcon size={"xl"} id={allureIcons.lineDevCodeSquare} className={styles["empty-placeholder-icon"]} />
        <Text className={styles["empty-placeholder-text"]}>{label}</Text>
      </div>
    </div>
  );
};
