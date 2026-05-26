/**
 * Matches URLs in free text the same way as Allure Report 2.
 * @see packages/plugin-allure2/static — linkify helper in the web bundle
 */
export const URL_IN_TEXT_RE = /((?:(?:https?:\/\/|ftp:\/\/|mailto:)|www\.)\S+?)(\s|"|'|\)|]|}|&#62|$)/g;

export type TextSegment = { type: "text"; value: string } | { type: "url"; value: string };

export const splitTextWithUrls = (text: string): TextSegment[] => {
  if (!text) {
    return [{ type: "text", value: "" }];
  }

  const segments: TextSegment[] = [];
  const re = new RegExp(URL_IN_TEXT_RE.source, URL_IN_TEXT_RE.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const matchIndex = match.index;
    const url = match[1];
    const terminator = match[2] ?? "";

    if (matchIndex > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
    }

    segments.push({ type: "url", value: url });
    lastIndex = matchIndex + url.length + terminator.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: "text", value: text }];
  }

  return segments;
};

export const textContainsUrl = (text: string): boolean => {
  const re = new RegExp(URL_IN_TEXT_RE.source, URL_IN_TEXT_RE.flags);
  re.lastIndex = 0;
  return re.test(text);
};
