import { sanitizeExternalUrl } from "@allurereport/core-api";
import { splitTextWithUrls, textContainsUrl } from "@allurereport/web-commons";
import type { FunctionalComponent } from "preact";

import { Text, type TextProps } from "@/components/Typography";

import linkStyles from "@/components/Link/styles.scss";

const resolveUrlHref = (url: string): string | undefined => {
  const hasExplicitProtocol = /^(?:https?:\/\/|mailto:|tel:)/.test(url);

  if (hasExplicitProtocol) {
    return sanitizeExternalUrl(url);
  }

  if (/^www\./.test(url)) {
    return sanitizeExternalUrl(`https://${url}`);
  }

  return sanitizeExternalUrl(url);
};

export type LinkifiedTextProps<Tag extends keyof preact.JSX.IntrinsicElements = "span"> = Omit<
  TextProps<Tag>,
  "children"
> & {
  text: string;
};

export const LinkifiedText = <Tag extends keyof preact.JSX.IntrinsicElements = "span">({
  text,
  ...textProps
}: LinkifiedTextProps<Tag>) => {
  if (!textContainsUrl(text)) {
    return <Text {...textProps}>{text}</Text>;
  }

  const segments = splitTextWithUrls(text);

  return (
    <Text {...textProps}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return segment.value;
        }

        const href = resolveUrlHref(segment.value);

        if (!href) {
          return segment.value;
        }

        return (
          <Text
            key={index}
            tag="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkStyles.link}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {segment.value}
          </Text>
        );
      })}
    </Text>
  );
};
