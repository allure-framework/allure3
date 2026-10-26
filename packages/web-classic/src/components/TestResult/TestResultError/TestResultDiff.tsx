import { Button, Code, CodeViewer } from "@allurereport/web-components";
import type { Change } from "diff";
import { diffChars, diffLines, diffWords } from "diff";
import { useMemo, useState } from "preact/hooks";

import { useI18n } from "@/stores";

import * as styles from "@/components/TestResult/TestResultError/styles.scss";

const diffFunctions = {
  chars: diffChars,
  words: diffWords,
  lines: diffLines,
} as const;

type DiffType = keyof typeof diffFunctions;
type ViewMode = "unified" | "side-by-side";

type DiffViewProps = {
  expected: string;
  actual: string;
  diff: Change[];
  t: (key: string) => string;
};

const DiffCode = ({ diff }: { diff: Change[] }) => (
  <>
    {diff.map((part, index) => (
      <div key={index} className={part.added ? styles["diff-green"] : part.removed ? styles["diff-red"] : ""}>
        {part.value}
      </div>
    ))}
  </>
);

const SideBySideView = ({ expected, diff, t }: DiffViewProps) => (
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
        <DiffCode diff={diff} />
      </CodeViewer>
    </div>
  </div>
);

const UnifiedView = ({ expected, diff }: DiffViewProps) => (
  <div className={styles.unified}>
    <CodeViewer className={styles["diff-screen"]}>
      <div className={styles["diff-grey"]}>{expected}</div>
      <DiffCode diff={diff} />
    </CodeViewer>
  </div>
);

export const TestResultDiff = ({ expected, actual }: { expected: string; actual: string }) => {
  const [diffType, setDiffType] = useState<DiffType>("lines");
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const diff = useMemo<Change[]>(
    () => (diffFunctions[diffType] as typeof diffLines)(expected, actual),
    [diffType, expected, actual],
  );
  const { t } = useI18n("controls");
  const viewProps: DiffViewProps = { expected, actual, diff, t };

  return (
    <div className={styles.diff} data-testid={"test-result-diff"}>
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
                onClick={() => setDiffType(type)}
              />
            );
          })}
        </div>
      </div>
      {viewMode === "side-by-side" ? <SideBySideView {...viewProps} /> : <UnifiedView {...viewProps} />}
    </div>
  );
};
