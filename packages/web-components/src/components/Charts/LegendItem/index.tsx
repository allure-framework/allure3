import clsx from "clsx";
import { useMemo } from "preact/hooks";
import { Text } from "@/components/Typography";
import { LegendIndicator } from "../LegendIndicator";
import styles from "./styles.scss";

interface LegendItemValue<T extends Record<string, number | string>> {
  id: Extract<keyof T, string>;
  color: string;
  pointHoverColor?: string;
  label: string | number;
  type?: "default" | "point" | "tree";
  link?: string;
  value?: string | number;
}

interface LegendItemProps<T extends Record<string, number | string>> {
  legend: LegendItemValue<T>;
  mode?: "default" | "menu";
  onClick?: (item: LegendItemValue<T>) => void;
}

const isPresent = (value: number | string | undefined): value is number | string => {
  return (typeof value === "number" && !Number.isNaN(value)) || (typeof value === "string" && !!value);
};

const formatNumber = (value: number | string | undefined, locale: string = "en-US") => {
  if (!isPresent(value)) {
    return "";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat(locale, {
      useGrouping: true,
    }).format(value);
  }

  return String(value);
};

const PointIcon = ({ color }: { color: string }) => {
  // @TODO: Move to icons
  return (
    <div className={styles.point}>
      <svg width="16" height="8" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 4H16" stroke={color} stroke-width="2" />
        <path
          // eslint-disable-next-line max-len
          d="M7.99902 7C9.65588 7 10.999 5.65685 10.999 4C10.999 2.34315 9.65588 1 7.99902 1C6.34217 1 4.99902 2.34315 4.99902 4C4.99902 5.65685 6.34217 7 7.99902 7Z"
          fill="#FAFCFF"
          fillOpacity="0.98"
          stroke={color}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

export const LegendItem = <T extends Record<string, number | string>>(props: LegendItemProps<T>) => {
  const { onClick, legend, mode = "default" } = props;
  const { color, label, link, value } = legend;

  const Tag = link ? "a" : "div";

  const type = legend.type ?? "default";

  const formattedValue = useMemo(() => {
    return formatNumber(value);
  }, [value]);

  return (
    <Tag
      href={link}
      className={clsx(styles.legendItem, link && styles.legendItemLink)}
      onClick={
        typeof onClick === "function"
          ? () => {
              onClick(legend);
            }
          : undefined
      }
    >
      <div className={styles.legendName}>
        {type === "default" && <LegendIndicator color={color} />}
        {type === "point" && <PointIcon color={color} />}
        <Text type="ui" size="s" className={styles.legendLabel}>
          {label}
        </Text>
      </div>
      {isPresent(value) && (
        <>
          <div className={clsx(mode === "menu" ? styles.menuSpace : styles.space)} />
          <Text type="ui" size="s" className={styles.legendValue}>
            {formattedValue}
          </Text>
        </>
      )}
    </Tag>
  );
};
