import { useComputed, useSignal } from "@preact/signals";
import { capitalize } from "lodash";
import type { ComponentChild } from "preact";
import { useRef } from "preact/hooks";
import { DropdownButton } from "@/components/Button";
import { Menu } from "@/components/Menu";
import { Tag } from "@/components/Tag";
import { Image } from "./Image.js";
import { useImageDiffContext } from "./hooks.js";
import { useI18n } from "./i18n.js";
import styles from "./styles.scss";
import { calculateSingleImageSize } from "./utils.js";

const ViewSelector = (props: {
  options: ("diff" | "actual" | "expected")[] | readonly ("diff" | "actual" | "expected")[];
  current: "diff" | "actual" | "expected";
  onChange: (option: "diff" | "actual" | "expected") => void;
}) => {
  const { options, current, onChange } = props;
  const i18n = useI18n();

  return (
    <Menu
      size="s"
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton
          style="ghost"
          size="s"
          text={i18n(`image.${current}`) ?? capitalize(current)}
          isExpanded={isOpened}
          onClick={onClick}
        />
      )}
    >
      <Menu.Section>
        {options
          .filter((option) => option !== current)
          .map((option) => (
            <Menu.Item key={option} onClick={() => onChange(option)}>
              {i18n(`image.${option}`) ?? capitalize(option)}
            </Menu.Item>
          ))}
      </Menu.Section>
    </Menu>
  );
};

const ImageLabel = (props: { sizes: { width: number; height: number }; children?: ComponentChild }) => {
  const { sizes, children } = props;

  return (
    <div className={styles.imageLabel}>
      {children}
      <Tag skin="secondary">{`${sizes.width}\u00A0\u00D7\u00A0${sizes.height}`}</Tag>
    </div>
  );
};

const ViewDiff = () => {
  const { images, imageDimensions, containerDimensions } = useImageDiffContext();

  const imageWidth = useComputed(() =>
    calculateSingleImageSize({
      diff: imageDimensions.value.diff.width,
      actual: imageDimensions.value.actual.width,
      expected: imageDimensions.value.expected.width,
      containerSize: containerDimensions.value.width,
    }),
  );

  return (
    <div className={styles.view}>
      <div className={styles.imageCard}>
        <ImageLabel
          sizes={{
            height: images.diff.value?.naturalHeight ?? 0,
            width: images.diff.value?.naturalWidth ?? 0,
          }}
        />
        <Image src={images.diff.value?.src} width={imageWidth.value} />
      </div>
    </div>
  );
};

const ViewActual = () => {
  const { images, imageDimensions, containerDimensions } = useImageDiffContext();

  const imageWidth = useComputed(() =>
    calculateSingleImageSize({
      diff: imageDimensions.value.diff.width,
      actual: imageDimensions.value.actual.width,
      expected: imageDimensions.value.expected.width,
      containerSize: containerDimensions.value.width,
    }),
  );

  return (
    <div className={styles.view}>
      <div className={styles.imageCard}>
        <ImageLabel
          sizes={{
            height: images.actual.value?.naturalHeight ?? 0,
            width: images.actual.value?.naturalWidth ?? 0,
          }}
        />
        <Image src={images.actual.value?.src} width={imageWidth.value} />
      </div>
    </div>
  );
};

const ViewExpected = () => {
  const { images, imageDimensions, containerDimensions } = useImageDiffContext();

  const imageWidth = useComputed(() =>
    calculateSingleImageSize({
      diff: imageDimensions.value.diff.width,
      actual: imageDimensions.value.actual.width,
      expected: imageDimensions.value.expected.width,
      containerSize: containerDimensions.value.width,
    }),
  );

  return (
    <div className={styles.view}>
      <div className={styles.imageCard}>
        <ImageLabel
          sizes={{
            height: images.expected.value?.naturalHeight ?? 0,
            width: images.expected.value?.naturalWidth ?? 0,
          }}
        />
        <Image src={images.expected.value?.src} width={imageWidth.value} />
      </div>
    </div>
  );
};

const OVERLAY_HANDLE_WIDTH = 3;

const ViewOverlay = () => {
  const { images, imageDimensions, containerDimensions } = useImageDiffContext();

  const bgImage = images.expected.value;
  const overlayImage = images.actual.value;

  const imageWidth = useComputed(() =>
    calculateSingleImageSize({
      diff: imageDimensions.value.diff.width,
      actual: imageDimensions.value.actual.width,
      expected: imageDimensions.value.expected.width,
      containerSize: containerDimensions.value.width,
    }),
  );

  const currentOverlayX = useSignal(imageWidth.value / 2);
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useSignal(false);

  const overlayX = useComputed(() => {
    const currentX = currentOverlayX.value;

    if (currentX < 0) {
      return 0;
    }

    if (currentX > imageWidth.value) {
      return imageWidth.value - OVERLAY_HANDLE_WIDTH;
    }

    return currentOverlayX.value;
  });

  const updateOverlayFromClientX = (clientX: number) => {
    const rect = overlayContainerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    currentOverlayX.value = clientX - rect.left;
  };

  const handlePointerDown = (event: PointerEvent) => {
    event.preventDefault();
    isDragging.value = true;

    // Keep receiving pointer events even if the pointer leaves the handle.
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    updateOverlayFromClientX(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging.value) {
      return;
    }
    updateOverlayFromClientX(event.clientX);
  };

  const stopDragging = () => {
    isDragging.value = false;
  };

  const overlayHeight = useComputed(() => {
    const scale = imageWidth.value / imageDimensions.value.actual.width;
    const scaleExpected = imageWidth.value / imageDimensions.value.expected.width;

    return Math.max(imageDimensions.value.actual.height * scale, imageDimensions.value.expected.height * scaleExpected);
  });

  return (
    <div className={styles.view}>
      <ImageLabel sizes={{ width: bgImage?.naturalWidth ?? 0, height: bgImage?.naturalHeight ?? 0 }} />
      <div
        ref={overlayContainerRef}
        className={styles.overlayContainer}
        style={{ width: imageWidth.value, height: overlayHeight.value }}
      >
        <div className={styles.imageCard}>
          <Image src={bgImage?.src} width={imageWidth.value} />
        </div>
        <div className={styles.imageCard} style={{ maxWidth: overlayX.value }}>
          <Image src={overlayImage?.src} width={imageWidth.value} />
        </div>
        <div
          className={styles.overlayHandle}
          style={{
            transform: `translateX(${overlayX.value}px)`,
            height: overlayHeight.value,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onLostPointerCapture={stopDragging}
          data-dragging={isDragging.value || undefined}
        />
      </div>
    </div>
  );
};

const SIDE_BY_SIDE_BREAKPOINT = 320;
const SIDE_BY_SIDE_GAP = 24;

const ViewSideBySide = () => {
  const { images, imageDimensions, containerDimensions } = useImageDiffContext();
  const leftOption = useSignal<"diff" | "actual" | "expected">("actual");
  const rightOption = useSignal<"diff" | "actual" | "expected">("expected");

  const leftOptions = useComputed(() => {
    return ["actual", "expected", "diff"] as const;
  });

  const rightOptions = useComputed(() => {
    return ["actual", "expected", "diff"] as const;
  });

  const leftImage = useComputed(() => {
    if (leftOption.value === "diff") {
      return [
        { width: images.diff.value?.naturalWidth ?? 0, height: images.diff.value?.naturalHeight ?? 0 },
        images.diff.value?.src,
      ] as const;
    }

    if (leftOption.value === "actual") {
      return [
        { width: images.actual.value?.naturalWidth ?? 0, height: images.actual.value?.naturalHeight ?? 0 },
        images.actual.value?.src,
      ] as const;
    }

    return [
      { width: images.expected.value?.naturalWidth ?? 0, height: images.expected.value?.naturalHeight ?? 0 },
      images.expected.value?.src,
    ] as const;
  });

  const rightImage = useComputed(() => {
    if (rightOption.value === "diff") {
      return [
        { width: images.diff.value?.naturalWidth ?? 0, height: images.diff.value?.naturalHeight ?? 0 },
        images.diff.value?.src,
      ] as const;
    }

    if (rightOption.value === "actual") {
      return [
        { width: images.actual.value?.naturalWidth ?? 0, height: images.actual.value?.naturalHeight ?? 0 },
        images.actual.value?.src,
      ] as const;
    }

    return [
      { width: images.expected.value?.naturalWidth ?? 0, height: images.expected.value?.naturalHeight ?? 0 },
      images.expected.value?.src,
    ] as const;
  });

  const imageWidth = useComputed(() =>
    calculateSingleImageSize({
      diff: imageDimensions.value.diff.width,
      actual: imageDimensions.value.actual.width,
      expected: imageDimensions.value.expected.width,
      containerSize: containerDimensions.value.width,
    }),
  );

  const sideBySideSize = useComputed(() => {
    const sizeForTwoImages = imageWidth.value * 2 + SIDE_BY_SIDE_GAP;

    if (sizeForTwoImages > containerDimensions.value.width) {
      return containerDimensions.value.width / 2 - SIDE_BY_SIDE_GAP;
    }

    return imageWidth.value;
  });

  const isRow = sideBySideSize.value > SIDE_BY_SIDE_BREAKPOINT;

  const [leftImageDimensions, leftImageSrc] = leftImage.value;
  const [rightImageDimensions, rightImageSrc] = rightImage.value;

  return (
    <div className={styles.view} data-row={isRow || undefined}>
      <div className={styles.imageCard}>
        <ImageLabel sizes={leftImageDimensions}>
          <ViewSelector
            options={leftOptions.value}
            current={leftOption.value}
            onChange={(option) => {
              leftOption.value = option;
            }}
          />
        </ImageLabel>
        <Image src={leftImageSrc} width={isRow ? sideBySideSize.value : containerDimensions.value.width} />
      </div>
      <div className={styles.imageCard}>
        <ImageLabel sizes={rightImageDimensions}>
          <ViewSelector
            options={rightOptions.value}
            current={rightOption.value}
            onChange={(option) => {
              rightOption.value = option;
            }}
          />
        </ImageLabel>
        <Image src={rightImageSrc} width={isRow ? sideBySideSize.value : containerDimensions.value.width} />
      </div>
    </div>
  );
};

export const DiffModeView = () => {
  const { diffMode } = useImageDiffContext();

  switch (diffMode.value) {
    case "diff":
      return <ViewDiff />;
    case "actual":
      return <ViewActual />;
    case "expected":
      return <ViewExpected />;
    case "side-by-side":
      return <ViewSideBySide />;
    case "overlay":
      return <ViewOverlay />;
  }
};
