import { clsx } from "clsx";
import type { FunctionalComponent, JSX } from "preact";

export const Text: FunctionalComponent<
  (
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
  } & Omit<JSX.HTMLAttributes, "type" | "size" | "className" | "bold" | "tag">
> = (props) => {
  const { size = "m", tag: Tag = "span", type = "paragraph", bold = false, className, children, ...rest } = props;

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

export const Code: FunctionalComponent<
  {
    type?: "paragraph" | "ui";
    size?: "s" | "m";
    /**
     * Additional class name
     */
    className?: string;
    bold?: boolean;
    tag?: keyof JSX.IntrinsicElements;
  } & Omit<JSX.HTMLAttributes, "type" | "size" | "className" | "bold" | "tag">
> = (props) => {
  const { size = "m", tag: Tag = "span", type = "paragraph", bold = false, className, children, ...rest } = props;

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
      // @ts-expect-error this is fine
      <Tag {...rest} className={clsx(`ui-code-${size}-ui${bold ? "-bold" : ""}`, className)}>
        {children}
      </Tag>
    );
  }

  return null;
};

export const Heading: FunctionalComponent<
  {
    size?: "s" | "m" | "l";
    /**
     * Additional class name
     */
    className?: string;
    tag?: keyof JSX.IntrinsicElements;
  } & Omit<JSX.HTMLAttributes, "size" | "className" | "tag">
> = (props) => {
  const { size = "m", tag: Tag = "span", className, children, ...rest } = props;

  return (
    // @ts-expect-error this is fine
    <Tag {...rest} className={clsx(`headings-head-${size}`, className)}>
      {children}
    </Tag>
  );
};
