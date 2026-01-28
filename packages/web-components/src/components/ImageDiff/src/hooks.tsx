import { batch, useComputed, useSignal, useSignalEffect } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useEffect } from "preact/hooks";
import { useDimensions } from "./Wrapper.js";
import type { DiffMode, ImageDiff } from "./model.js";

const diffModesFromDiff = (diff: ImageDiff) => {
  const modes: DiffMode[] = [];

  if (diff.actual) {
    modes.push("actual");
  }

  if (diff.expected) {
    modes.push("expected");
  }

  if (diff.diff) {
    modes.push("diff");
  }

  if (diff.actual && diff.expected) {
    modes.push("overlay");
  }

  if (diff.actual && diff.expected) {
    modes.push("side-by-side");
  }

  return modes;
};

const loadImage = async (src?: string): Promise<HTMLImageElement | null> => {
  if (!src) {
    return null;
  }

  const image = new Image();

  const load = new Promise((f) => {
    image.onload = f;
    image.onerror = f;
  });

  image.src = src;

  await load;

  return image;
};

const getDPR = () => {
  if (typeof window === "undefined") {
    return 1;
  }

  return window.devicePixelRatio;
};

const useImageDiff = (diff: ImageDiff) => {
  const dimensions = useDimensions();

  const isLoading = useSignal<boolean>(true);
  const expImgSignal = useSignal<HTMLImageElement | null>(null);
  const actualImgSignal = useSignal<HTMLImageElement | null>(null);
  const diffImgSignal = useSignal<HTMLImageElement | null>(null);
  const containerDimensions = useSignal<{ width: number; height: number }>(dimensions);

  useEffect(() => {
    containerDimensions.value = dimensions;
  }, [dimensions, containerDimensions]);

  const diffModes = useComputed(() => {
    let initialModes = diffModesFromDiff(diff);

    if (expImgSignal.value === null) {
      initialModes = initialModes.filter(
        (mode) => mode !== "expected" && mode !== "overlay" && mode !== "side-by-side",
      );
    }

    if (actualImgSignal.value === null) {
      initialModes = initialModes.filter((mode) => mode !== "actual" && mode !== "overlay" && mode !== "side-by-side");
    }

    if (diffImgSignal.value === null) {
      initialModes = initialModes.filter((mode) => mode !== "diff");
    }

    return initialModes;
  });

  const currentDiffMode = useSignal<DiffMode>(diffModes.value[0]);

  useSignalEffect(() => {
    if (isLoading.value === false) {
      currentDiffMode.value = diffModes.value[0];
    }
  });

  const failedToLoad = useComputed(() => {
    if (diffModes.value.length === 0) {
      return true;
    }

    if (diff.actual && actualImgSignal.value === null) {
      return true;
    }

    if (diff.expected && expImgSignal.value === null) {
      return true;
    }

    if (diff.diff && diffImgSignal.value === null) {
      return true;
    }

    return false;
  });

  const imageDimensions = useComputed(() => {
    const dpr = getDPR();

    return {
      expected: {
        width: (expImgSignal.value?.naturalWidth ?? 0) / dpr,
        height: (expImgSignal.value?.naturalHeight ?? 0) / dpr,
      },
      actual: {
        width: (actualImgSignal.value?.naturalWidth ?? 0) / dpr,
        height: (actualImgSignal.value?.naturalHeight ?? 0) / dpr,
      },
      diff: {
        width: (diffImgSignal.value?.naturalWidth ?? 0) / dpr,
        height: (diffImgSignal.value?.naturalHeight ?? 0) / dpr,
      },
    };
  });

  useEffect(() => {
    const abortController = new AbortController();

    isLoading.value = true;

    Promise.all([loadImage(diff.expected), loadImage(diff.actual), loadImage(diff.diff)]).then(
      ([expImg, actualImg, diffImg]) => {
        if (abortController.signal.aborted) {
          return;
        }

        batch(() => {
          expImgSignal.value = expImg;
          actualImgSignal.value = actualImg;
          diffImgSignal.value = diffImg;
          isLoading.value = false;
        });
      },
    );

    return () => {
      abortController.abort();
    };
  }, [diff, isLoading, expImgSignal, actualImgSignal, diffImgSignal]);

  return {
    data: diff,
    diffModes,
    isLoading,
    failedToLoad,
    containerDimensions,
    imageDimensions,
    images: {
      expected: expImgSignal,
      actual: actualImgSignal,
      diff: diffImgSignal,
    },
    diffMode: currentDiffMode,
  } as const;
};

const ImageDiffContext = createContext<ReturnType<typeof useImageDiff> | null>(null);

export const useImageDiffContext = () => {
  const context = useContext(ImageDiffContext);
  if (!context) {
    throw new Error("ImageDiffContext must be used within a ImageDiffContextProvider");
  }
  return context;
};

export const ImageDiffProvider = (props: { children: ComponentChildren; diff: ImageDiff }) => {
  const { children, diff } = props;
  const value = useImageDiff(diff);

  return <ImageDiffContext.Provider value={value}>{children}</ImageDiffContext.Provider>;
};
