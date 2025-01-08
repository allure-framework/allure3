import type { FunctionComponent } from "preact";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";

export const Label: FunctionComponent = ({ children }) => (
  <div className={styles.label}>
    <Text size="s" bold type="ui">
      {children}
    </Text>
  </div>
);
