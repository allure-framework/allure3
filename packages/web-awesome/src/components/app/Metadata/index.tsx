import clsx from "clsx";
import i18n from "i18next";
import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import LineGeneralCopy3 from "@/assets/svg/line-general-copy-3.svg";
import { MetadataButton } from "@/components/app/MetadataButton";
import { MetadataProps } from "@/components/app/ReportMetadata";
import { Button } from "@/components/commons/Button";
import { Menu } from "@/components/commons/Menu";
import { Text } from "@/components/commons/Typography";
import { useI18n } from "@/stores/locale";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

const { t } = useI18n("ui");

export const MetadataList: FunctionalComponent<MetadataProps & { columns?: number }> = ({
  envInfo,
  size = "m",
  columns = 2,
}) => {
  return (
    <div
      class={styles["report-metadata-list"]}
      style={{ gridTemplateColumns: `repeat(${columns}, ${100 / columns - 5}%)` }}
    >
      {envInfo?.map((envInfo) => (
        <MetadataKeyValue size={size} title={envInfo.name} value={envInfo.value} values={envInfo.values} />
      ))}
    </div>
  );
};

export const TestResultMetadataList: FunctionalComponent<MetadataProps> = ({ groupedLabels, size = "m" }) => {
  return (
    <div class={styles["report-metadata-list"]}>
      {groupedLabels &&
        Object.entries(groupedLabels)?.map(([name, values]) => (
          <MetadataKeyValue size={size} title={name} values={values} />
        ))}
    </div>
  );
};
export const Metadata: FunctionalComponent<MetadataProps> = ({ envInfo }) => {
  const [isOpened, setIsOpen] = useState(true);
  return (
    <div class={styles["report-metadata"]}>
      <MetadataButton isOpened={isOpened} setIsOpen={setIsOpen} counter={envInfo.length} title={t("metadata")} />
      {isOpened && <MetadataList envInfo={envInfo} />}
    </div>
  );
};
const MetadataTooltip = ({ value }) => {
  const { t } = useI18n("ui");
  return (
    <div className={styles["metadata-tooltip"]}>
      <div className={styles["metadata-tooltip-value"]}>
        <Text>{value}</Text>
      </div>
      <Button style={"outline"} icon={LineGeneralCopy3.id} text={t("copy")} onClick={() => copyToClipboard(value)} />
    </div>
  );
};
const MetaDataKeyLabel: FunctionalComponent<{
  size?: "s" | "m";
  value: string;
}> = ({ size = "s", value }) => {
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
        <MetadataTooltip value={value} />
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
    <div className={styles["report-metadata-keyvalue"]}>
      <Text
        type={"ui"}
        size={size}
        className={clsx(styles["report-metadata-keyvalue-title"], styles[`report-metadata-${size}`])}
      >
        {title}
      </Text>
      {values?.length ? (
        <div className={styles["report-metadata-values"]}>
          {values.map((item) => (
            <MetaDataKeyLabel value={item} />
          ))}
        </div>
      ) : (
        <div className={styles["report-metadata-values"]}>
          <MetaDataKeyLabel value={value} />
        </div>
      )}
    </div>
  );
};
