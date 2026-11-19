import type { DiffCharsOptionsNonabortable, Change } from "diff";
import { diffChars, diffLines, diffWords } from "diff";
import { useMemo, useState } from "preact/hooks";

import { CodeViewer } from "@/components/Attachment/CodeViewer";
import { Button } from "@/components/Button";
import { Code } from "@/components/Typography";

import styles from "./styles.scss";

const diffFunctions: Record<
  "chars" | "words" | "lines",
  (expected: string, actual: string, options?: DiffCharsOptionsNonabortable) => Change[]
> = {
  chars: diffChars,
  words: diffWords,
  lines: diffLines,
};

type DiffType = keyof typeof diffFunctions;
type ViewMode = "unified" | "side-by-side";

export type ErrorDiffI18nKey = "expected" | "actual" | "viewMode" | "compareBy" | ViewMode | DiffType;

export type ErrorDiffProps = {
  expected: string;
  actual: string;
  i18n: (key: ErrorDiffI18nKey) => string;
};

type DiffViewProps = ErrorDiffProps & { diff: Change[] };

const DiffCode = ({ diff }: { diff: Change[] }) => (
  <>
    {diff.map((part, index) => (
      <div key={index} className={part.added ? styles["diff-green"] : part.removed ? styles["diff-red"] : ""}>
        {part.value}
      </div>
    ))}
  </>
);

const SideBySideView = ({ expected, diff, i18n }: DiffViewProps) => (
  <div className={styles["side-by-side"]}>
    <div className={styles.side}>
      <Code type={"ui"} size={"s"} className={styles["side-title"]}>
        {i18n("expected")}
      </Code>
      <CodeViewer code={expected} className={styles["diff-screen"]} />
    </div>
    <div className={styles.side}>
      <div className={styles.expected}>
        <Code size={"s"} className={styles["side-title"]}>
          {i18n("actual")}
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

/**
 * Expected/actual comparison of a test error, opened by the reports in a modal.
 * Kept out of the `core` entry so the `diff` library loads only with it.
 */
export const ErrorDiff = ({ expected, actual, i18n }: ErrorDiffProps) => {
  const [diffType, setDiffType] = useState<DiffType>("lines");
  const [viewMode, setViewMode] = useState<ViewMode>("unified");
  const diff = useMemo<Change[]>(() => diffFunctions[diffType](expected, actual), [diffType, expected, actual]);
  const viewProps: DiffViewProps = { expected, actual, diff, i18n };

  return (
    <div className={styles.diff} data-testid={"test-result-diff"}>
      <div className={styles["diff-controls"]}>
        <div className={styles["diff-buttons"]}>
          <Code size={"s"} className={styles["diff-buttons-title"]}>
            {i18n("viewMode")}:
          </Code>
          <div className={styles["diff-view"]}>
            {(["unified", "side-by-side"] as const).map((mode) => (
              <Button
                key={mode}
                size={"s"}
                style={viewMode === mode ? "primary" : "outline"}
                text={i18n(mode)}
                onClick={() => setViewMode(mode)}
              />
            ))}
          </div>
        </div>
        <div className={styles["diff-buttons"]}>
          <Code size={"s"} className={styles["diff-buttons-title"]}>
            {i18n("compareBy")}:
          </Code>
          {(["chars", "words", "lines"] as const).map((type) => (
            <Button
              key={type}
              size={"s"}
              style={diffType === type ? "primary" : "outline"}
              text={i18n(type)}
              onClick={() => setDiffType(type)}
            />
          ))}
        </div>
      </div>
      {viewMode === "side-by-side" ? <SideBySideView {...viewProps} /> : <UnifiedView {...viewProps} />}
    </div>
  );
};
