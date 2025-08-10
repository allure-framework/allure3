import type { FunctionalComponent } from "preact";
import { Widget } from "@/components/Widget";
import { Heading } from "@/components/Typography";
import styles from "./styles.scss";

export interface ComingSoonChartWidgetProps {
  title: string;
}

export const ComingSoonChartWidget: FunctionalComponent<ComingSoonChartWidgetProps> = ({
  title,
}) => {
  return (
    <Widget title={title}>
      <div className={styles.comingSoonChart}>
        <Heading size="s" className={styles.message}>
          Coming soon
        </Heading>
      </div>
    </Widget>
  );
};
