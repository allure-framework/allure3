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
        <SvgIcon
          size={"m"}
          width={"32px"}
          height={"32px"}
          id={allureIcons.lineDevCodeSquare}
          className={styles["empty-placeholder-icon"]}
        />
        <Text className={styles["empty-placeholder-text"]}>{label}</Text>
      </div>
    </div>
  );
};
