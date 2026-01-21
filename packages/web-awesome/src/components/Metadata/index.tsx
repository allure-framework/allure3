import { Button, ButtonLink, Menu, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { MetadataButton } from "@/components/MetadataButton";
import type { MetadataProps } from "@/components/ReportMetadata";
import { useI18n } from "@/stores/locale";
import { getTagsFilterUrl } from "@/stores/reportFilters/utils";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

export const MetadataList: FunctionalComponent<MetadataProps & { columns?: number }> = ({
  envInfo,
  size = "m",
  columns = 2,
}) => {
  return (
    <div
      class={styles["report-metadata-list"]}
      style={{ gridTemplateColumns: `repeat(${columns}, ${100 / columns - 5}%)` }}
      data-testid={"metadata-list"}
    >
      {envInfo?.map(({ name, values, value }) => (
        <MetadataKeyValue key={name} size={size} title={name} value={value} values={values} />
      ))}
    </div>
  );
};

export const TrMetadataList: FunctionalComponent<MetadataProps> = ({ groupedLabels, size = "m" }) => {
  return (
    <div class={styles["report-metadata-list"]}>
      {groupedLabels &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        Object.entries(groupedLabels)?.map(([name, values]) => (
          <MetadataKeyValue key={name} size={size} title={name} values={values} />
        ))}
    </div>
  );
};

export const Metadata: FunctionalComponent<MetadataProps> = ({ envInfo }) => {
  const { t } = useI18n("ui");
  const [isOpened, setIsOpen] = useState(true);

  return (
    <div class={styles["report-metadata"]}>
      <MetadataButton isOpened={isOpened} setIsOpen={setIsOpen} counter={envInfo.length} title={t("metadata")} />
      {isOpened && <MetadataList envInfo={envInfo} />}
    </div>
  );
};

const OpenFilterUrlButton: FunctionalComponent<{ url: string }> = ({ url }) => {
  const { t } = useI18n("filters");

  return (
    <ButtonLink
      href={url}
      target="_blank"
      style="ghost"
      icon={allureIcons.lineGeneralLinkExternal}
      text={t("goto_filter")}
    />
  );
};

const MetadataTooltip = (props: { value: string; name: string }) => {
  const { value, name } = props;
  const { t } = useI18n("ui");

  return (
    <div className={styles["metadata-tooltip"]}>
      <div className={styles["metadata-tooltip-value"]}>
        <Text>{value}</Text>
      </div>
      {name === "tag" && <OpenFilterUrlButton url={getTagsFilterUrl([value])} />}
      <Button
        style={"outline"}
        icon={allureIcons.lineGeneralCopy3}
        text={t("copy")}
        onClick={() => copyToClipboard(value)}
      />
    </div>
  );
};

const MetaDataKeyLabel: FunctionalComponent<{
  name: string;
  size?: "s" | "m";
  value: string;
}> = ({ name, size = "s", value }) => {
  return (
    <Menu
      size="xl"
      menuTrigger={({ onClick }) => (
        <div className={styles["report-metadata-keyvalue-wrapper"]}>
          <Text type={"ui"} size={size} onClick={onClick} bold className={styles["report-metadata-keyvalue-value"]}>
            {value}
          </Text>
        </div>
      )}
    >
      <Menu.Section>
        <MetadataTooltip value={value} name={name} />
      </Menu.Section>
    </Menu>
  );
};

const MetadataKeyValue: FunctionalComponent<{
  title: string;
  value?: string;
  values?: string[];
  size?: "s" | "m";
}> = ({ title, value, values, size = "m" }) => {
  return (
    <div className={styles["report-metadata-keyvalue"]} data-testid={"metadata-item"}>
      <Text
        type={"ui"}
        size={size}
        className={clsx(styles["report-metadata-keyvalue-title"], styles[`report-metadata-${size}`])}
        data-testid={"metadata-item-key"}
      >
        {title}
      </Text>
      {values?.length ? (
        <div className={styles["report-metadata-values"]} data-testid={"metadata-item-value"}>
          {values.map((item) => (
            <MetaDataKeyLabel key={item} value={item} name={title} />
          ))}
        </div>
      ) : (
        <div className={styles["report-metadata-values"]} data-testid={"metadata-item-value"}>
          <MetaDataKeyLabel value={value} name={title} />
        </div>
      )}
    </div>
  );
};
