import { Heading } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import * as styles from "./Widget.module.scss";

interface WidgetProps {
  title: string;
}

export const Widget: FunctionalComponent<WidgetProps> = ({ children, title }) => {
  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.dragArea} />
        <Heading size="s">{title}</Heading>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
