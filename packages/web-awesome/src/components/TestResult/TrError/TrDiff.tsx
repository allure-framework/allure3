import { Button, Code, CodeViewer } from "@allurereport/web-components";
import type { BaseOptions, Change } from "diff";
import { diffChars, diffLines, diffWords } from "diff";
import { useState } from "preact/hooks";
import * as styles from "@/components/TestResult/TrError/styles.scss";
import { useI18n } from "@/stores";

const diffFunctions = {
  chars: diffChars,
  words: diffWords,
  lines: diffLines,
} as const;

type DiffType = keyof typeof diffFunctions;
type ViewMode = "unified" | "side-by-side";

export const TrDiff = ({ expected, actual }: { expected: string; actual: string }) => {
  const [diffType, setDiffType] = useState<DiffType>("lines");
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const [diff, setDiff] = useState<Change[]>(() => diffLines(expected, actual));
  const { t } = useI18n("controls");

  const DiffCode = () => {
    return (
      <>
        {diff.map((part, index) => (
          <div key={index} className={part.added ? styles["diff-green"] : part.removed ? styles["diff-red"] : ""}>
            {part.value}
          </div>
        ))}
      </>
    );
  };
  const changeTypeDiff = (type: DiffType = "chars") => {
    const diffFn = diffFunctions[type];
    const result = (diffFn as (oldStr: string, newStr: string, options?: BaseOptions) => Change[])(
      expected,
      actual,
      {},
    );

    setDiffType(type);
    setDiff(result);
  };

  const SideBySideView = () => {
    return (
      <div className={styles["side-by-side"]}>
        <div className={styles.side}>
          <Code type={"ui"} size={"s"} className={styles["side-title"]}>
            {t("expected")}
          </Code>
          <CodeViewer code={expected} className={styles["diff-screen"]} />
        </div>
        <div className={styles.side}>
          <div className={styles.expected}>
            <Code size={"s"} className={styles["side-title"]}>
              {t("actual")}
            </Code>
          </div>
          <CodeViewer className={styles["diff-screen"]}>
            <DiffCode />
          </CodeViewer>
        </div>
      </div>
    );
  };

  const UnifiedView = () => {
    return (
      <>
        <div className={styles.unified}>
          <CodeViewer className={styles["diff-screen"]}>
            <div className={styles["diff-grey"]}>{expected}</div>
            <DiffCode />
          </CodeViewer>
        </div>
      </>
    );
  };

  return (
    <div className={styles.diff} data-testId={"test-result-diff"}>
      <div className={styles["diff-controls"]}>
        <div className={styles["diff-buttons"]}>
          <Code size={"s"} className={styles["diff-buttons-title"]}>
            {t("viewMode")}:
          </Code>
          <div className={styles["diff-view"]}>
            {["unified", "side-by-side"].map((mode: ViewMode) => (
              <Button
                key={mode}
                size={"s"}
                style={viewMode === mode ? "primary" : "outline"}
                text={t(mode)}
                onClick={() => setViewMode(mode)}
              />
            ))}
          </div>
        </div>
        <div className={styles["diff-buttons"]}>
          <Code size={"s"} className={styles["diff-buttons-title"]}>
            {t("compareBy")}:
          </Code>
          {["chars", "words", "lines"].map((type: DiffType) => {
            return (
              <Button
                key={type}
                size={"s"}
                style={diffType === type ? "primary" : "outline"}
                text={t(type)}
                onClick={() => changeTypeDiff(type)}
              />
            );
          })}
        </div>
      </div>
      {viewMode === "side-by-side" ? <SideBySideView /> : <UnifiedView />}
    </div>
  );
};
