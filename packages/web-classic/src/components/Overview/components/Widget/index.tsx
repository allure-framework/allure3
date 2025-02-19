import type { FunctionalComponent, ComponentChildren } from "preact";
import * as styles from "./Widget.module.scss";

interface WidgetProps {
  children: ComponentChildren;
  title: string;
}

export const Widget: FunctionalComponent<WidgetProps> = ({ children, title }) => {
  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.dragArea} />
        <h3 className={styles.title}>{title}</h3>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
