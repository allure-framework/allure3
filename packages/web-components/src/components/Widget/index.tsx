import type { FunctionalComponent } from "preact";
import { Heading } from "@/components/Typography";
import styles from "./styles.scss";

interface WidgetProps {
  title?: string;
  centerContent?: boolean;
  dropShadow?: boolean;
}

export const Widget: FunctionalComponent<WidgetProps> = ({ children, title, centerContent, dropShadow = true }) => {
  return (
    <div className={styles.widget} data-drop-shadow={dropShadow || undefined}>
      {title && (
        <div className={styles.header}>
          <Heading size="s">{title}</Heading>
        </div>
      )}
      <div className={styles.content} data-center-content={centerContent}>
        {children}
      </div>
    </div>
  );
};
