import { Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { FunctionalComponent } from "preact";

import * as styles from "./styles.scss";

export type MetadataProps = {
  count?: number | string;
  title?: string;
  type?: string;
  status?: string;
};

export const MetadataValue: FunctionalComponent<MetadataProps> = ({ count }) => {
  return (
    <Text data-testid="metadata-value" type={"ui"} size={"m"} tag={"span"} className={styles["metadata-item-value"]}>
      {count}
    </Text>
  );
};

interface ReportMetadataItemProps {
  active?: boolean;
  className?: string;
  onClick?: () => void;
  renderComponent?: FunctionalComponent<MetadataProps>;
  props?: MetadataProps;
}

const MetadataItem: FunctionalComponent<ReportMetadataItemProps> = ({
  active = false,
  className,
  onClick,
  renderComponent: RenderComponent = MetadataValue,
  props,
  ...rest
}) => {
  const { title } = props || {};
  const content = (
    <>
      <Text type={"ui"} size={"s"} tag={"span"} className={styles["metadata-item-title"]}>
        {title}
      </Text>
      {RenderComponent ? <RenderComponent {...props} /> : <MetadataValue {...props} />}
    </>
  );

  if (onClick) {
    return (
      <button
        {...rest}
        type="button"
        className={clsx("metadata-item", styles["metadata-item-clickable"], className)}
        onClick={onClick}
        aria-pressed={active}
      >
        {content}
      </button>
    );
  }

  return (
    <div {...rest} className={clsx("metadata-item", className)}>
      {content}
    </div>
  );
};

export default MetadataItem;
