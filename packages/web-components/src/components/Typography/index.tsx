import { clsx } from "clsx";
import type { FunctionalComponent, JSX } from "preact";

export type TextProps = (
  | {
      type?: "paragraph";
      size?: "s" | "m" | "l";
    }
  | {
      type: "ui";
      size: "s" | "m" | "l" | "xs";
    }
) & {
  /**
   * Additional class name
   */
  className?: string;
  bold?: boolean;
  tag?: keyof JSX.IntrinsicElements;
} & Omit<JSX.HTMLAttributes, "type" | "size" | "className" | "bold" | "tag">;

export const Text: FunctionalComponent<TextProps> = ({
  size = "m",
  tag: Tag = "span",
  type = "paragraph",
  bold = false,
  className,
  children,
  ...rest
}) => {
  if (type === "paragraph") {
    return (
      // @ts-expect-error this is fine
      <Tag {...rest} className={clsx(`paragraphs-text-${size}${bold ? "-bold" : ""}`, className)}>
        {children}
      </Tag>
    );
  }

  if (type === "ui") {
    return (
      // @ts-expect-error this is fine
      <Tag {...rest} className={clsx(`ui-text-${size}-ui${bold ? "-bold" : ""}`, className)}>
        {children}
      </Tag>
    );
  }

  return null;
};

export type CodeProps = {
  type?: "paragraph" | "ui";
  size?: "s" | "m";
  /**
   * Additional class name
   */
  className?: string;
  bold?: boolean;
  tag?: keyof JSX.IntrinsicElements;
};

export const Code: FunctionalComponent<CodeProps> = ({
  size = "m",
  tag: Tag = "span",
  type = "paragraph",
  bold = false,
  className,
  children,
  ...rest
}) => {
  if (type === "paragraph") {
    return (
      // @ts-expect-error this is fine
      <Tag {...rest} className={clsx(`paragraphs-code-${size}${bold ? "-bold" : ""}`, className)}>
        {children}
      </Tag>
    );
  }

  if (type === "ui") {
    return (
      <Tag {...rest} className={clsx(`ui-code-${size}-ui${bold ? "-bold" : ""}`, className)}>
        {children}
      </Tag>
    );
  }

  return null;
};

export type HeadingProps = {
  size?: "s" | "m" | "l";
  /**
   * Additional class name
   */
  className?: string;
  tag?: keyof JSX.IntrinsicElements;
} & Omit<JSX.HTMLAttributes, "size" | "className" | "tag">;

export const Heading: FunctionalComponent<HeadingProps> = ({
  size = "m",
  tag: Tag = "span",
  className,
  children,
  ...rest
}) => {
  return (
    // @ts-expect-error this is fine
    <Tag {...rest} className={clsx(`headings-head-${size}`, className)}>
      {children}
    </Tag>
  );
};
