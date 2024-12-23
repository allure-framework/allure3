import { Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export type MetadataProps = {
  count?: number;
  title?: string;
  type?: string;
  status?: string;
};

export const MetadataValue: FunctionalComponent<MetadataProps> = ({ count }) => {
  return (
    <Text data-testid="metadata-value" type={"ui"} size={"m"} tag={"div"} className={styles["metadata-item-value"]}>
      {count}
    </Text>
  );
};

interface ReportMetadataItemProps {
  className?: string;
  renderComponent?: FunctionalComponent<MetadataProps>;
  props?: MetadataProps;
}

const MetadataItem: FunctionalComponent<ReportMetadataItemProps> = ({
  className,
  renderComponent: RenderComponent = MetadataValue,
  props,
  ...rest
}) => {
  const { title } = props || {};

  return (
    <div {...rest} className={clsx("metadata-item", className)}>
      <Text type={"ui"} size={"s"} tag={"div"} className={styles["metadata-item-title"]}>
        {title}
      </Text>
      {RenderComponent ? <RenderComponent {...props} /> : <MetadataValue {...props} />}
    </div>
  );
};

export default MetadataItem;
