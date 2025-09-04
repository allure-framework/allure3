import AnsiToHtml from "ansi-to-html";

/**
 * The same type that has been exported from the ansi-to-html package.
 */
export interface AnsiToHtmlConfig {
  /** The default foreground color used when reset color codes are encountered. */
  fg?: string;
  /** The default background color used when reset color codes are encountered. */
  bg?: string;
  /** Convert newline characters to `<br/>`. */
  newline?: boolean;
  /** Generate HTML/XML entities. */
  escapeXML?: boolean;
  /** Save style state across invocations of `toHtml()`. */
  stream?: boolean;
  /** Can override specific colors or the entire ANSI palette. */
  colors?: string[] | {[code: number]: string};
}

// eslint-disable-next-line no-control-regex
const ansiRegex = /\x1B\[[0-9;?]*[ -/]*[@-~]/g;

export const capitalize = (str: string) => {
  if (!str) {
    return;
  }
  return str.charAt(0).toLocaleUpperCase() + str.slice(1);
};

export const isAnsi = (text?: string): boolean => typeof text === "string" && new RegExp(ansiRegex).test(text);

/**
 * Pre-sanitized by XML escaping ANSI to HTML converter.
 * @param text ANSI text to convert to HTML.
 * @param config Config for the ansi-to-html package.
 * @returns HTML string.
 */
export const ansiToHTML = (text: string, config?: AnsiToHtmlConfig) =>
  new AnsiToHtml({
    escapeXML: true,
    ...config
  }).toHtml(text);
