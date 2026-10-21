import type { ComponentChildren, ComponentType } from "preact";
import { lazy, Suspense } from "preact/compat";
import { useErrorBoundary, useMemo, useState } from "preact/hooks";

import { Button } from "../Button";
import { EmptyView } from "../EmptyView";

export type ComponentLoader<P> = () => Promise<{ default: ComponentType<P> }>;

export const LazyComponent = <P extends object>({
  loader,
  componentProps,
  fallback,
  errorMessage,
  retryLabel,
}: {
  loader: ComponentLoader<P>;
  componentProps: P;
  fallback: ComponentChildren;
  errorMessage: string;
  retryLabel: string;
}) => {
  const [error, resetError] = useErrorBoundary();
  const [attempt, setAttempt] = useState(0);
  // Preact lazy caches rejected imports. A retry or a new mounted viewer needs
  // a fresh lazy instance; ordinary prop updates keep the loaded component.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- attempt intentionally replaces a rejected lazy instance.
  const Component = useMemo(() => lazy(loader), [loader, attempt]);

  if (error) {
    return (
      <EmptyView description={errorMessage} size="xs">
        <Button
          style="flat"
          text={retryLabel}
          onClick={() => {
            setAttempt((value) => value + 1);
            resetError();
          }}
        />
      </EmptyView>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <Component {...componentProps} />
    </Suspense>
  );
};
