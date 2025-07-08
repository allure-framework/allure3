import DOMPurify from "dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML content to sanitize
 * @param options - DOMPurify configuration options
 * @returns Sanitized HTML string
 */
export const sanitizeHtml = (html: string, options?: DOMPurify.Config): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Default configuration for HTML content
  const defaultOptions: DOMPurify.Config = {
    ALLOWED_TAGS: [
      // Basic text formatting
      "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "del", "ins",
      // Headings
      "h1", "h2", "h3", "h4", "h5", "h6",
      // Lists
      "ul", "ol", "li", "dl", "dt", "dd",
      // Links
      "a",
      // Code
      "code", "pre", "kbd", "samp", "var",
      // Tables
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
      // Blockquotes
      "blockquote", "cite",
      // Images (for safe display)
      "img",
      // Other
      "hr", "sub", "sup", "small", "mark", "time", "abbr", "acronym", "dfn"
    ],
    ALLOWED_ATTR: [
      // Basic attributes
      "id", "class", "style", "title", "lang", "dir",
      // Link attributes
      "href", "target", "rel",
      // Table attributes
      "colspan", "rowspan", "scope", "headers",
      // Code attributes
      "data-lang", "data-line",
      // Image attributes
      "src", "alt", "width", "height",
      // Time attributes
      "datetime",
      // Abbreviation attributes
      "title"
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Disable script execution
    FORBID_TAGS: ["script", "object", "embed", "form", "input", "textarea", "select", "button", "iframe"],
    FORBID_ATTR: [
      "onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur",
      "onchange", "onsubmit", "onreset", "onselect", "onunload", "onabort", "onbeforeunload",
      "onerror", "onhashchange", "onmessage", "onoffline", "ononline", "onpagehide",
      "onpageshow", "onpopstate", "onresize", "onstorage", "oncontextmenu", "onkeydown",
      "onkeypress", "onkeyup", "onmousedown", "onmousemove", "onmouseup", "onwheel",
      "oncopy", "oncut", "onpaste", "onselectstart", "onbeforecopy", "onbeforecut",
      "onbeforepaste", "onbeforeprint", "onafterprint", "onbeforeeditfocus",
      "onactivate", "onbeforeactivate", "onbeforedeactivate", "ondeactivate",
      "onfocusin", "onfocusout", "onhelp", "onmouseenter", "onmouseleave",
      "onmousewheel", "onmove", "onmoveend", "onmovestart", "onpropertychange",
      "onreadystatechange", "onrowsdelete", "onrowsinserted", "onstop", "onlosecapture"
    ],
    // Keep text content but remove dangerous elements
    KEEP_CONTENT: true,
    // Return DOM instead of string for better control
    RETURN_DOM: false,
    // Return DOM fragment
    RETURN_DOM_FRAGMENT: false,
    // Return trusted types
    RETURN_TRUSTED_TYPE: false
  };

  const config = { ...defaultOptions, ...options };
  
  return DOMPurify.sanitize(html, config);
};

/**
 * Sanitizes ANSI-to-HTML converted content specifically for code display
 * @param html - The HTML content from ANSI conversion
 * @returns Sanitized HTML string safe for code display
 */
export const sanitizeAnsiHtml = (html: string): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Stricter configuration for ANSI-converted content
  const ansiOptions: DOMPurify.Config = {
    ALLOWED_TAGS: [
      // Only allow span tags for ANSI color formatting
      "span"
    ],
    ALLOWED_ATTR: [
      // Only allow style attribute for ANSI colors
      "style"
    ],
    // Disable all potentially dangerous content
    FORBID_TAGS: ["script", "object", "embed", "form", "input", "textarea", "select", "button", "iframe", "img", "a"],
    FORBID_ATTR: [
      "onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur",
      "onchange", "onsubmit", "onreset", "onselect", "onunload", "onabort", "onbeforeunload",
      "onerror", "onhashchange", "onmessage", "onoffline", "ononline", "onpagehide",
      "onpageshow", "onpopstate", "onresize", "onstorage", "oncontextmenu", "onkeydown",
      "onkeypress", "onkeyup", "onmousedown", "onmousemove", "onmouseup", "onwheel",
      "oncopy", "oncut", "onpaste", "onselectstart", "onbeforecopy", "onbeforecut",
      "onbeforepaste", "onbeforeprint", "onafterprint", "onbeforeeditfocus",
      "onactivate", "onbeforeactivate", "onbeforedeactivate", "ondeactivate",
      "onfocusin", "onfocusout", "onhelp", "onmouseenter", "onmouseleave",
      "onmousewheel", "onmove", "onmoveend", "onmovestart", "onpropertychange",
      "onreadystatechange", "onrowsdelete", "onrowsinserted", "onstop", "onlosecapture",
      "href", "src", "data", "action", "method"
    ],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  };

  return DOMPurify.sanitize(html, ansiOptions);
};

/**
 * Sanitizes HTML content for attachment previews with minimal allowed content
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string safe for attachment preview
 */
export const sanitizeAttachmentHtml = (html: string): string => {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Very strict configuration for attachment previews
  const attachmentOptions: DOMPurify.Config = {
    ALLOWED_TAGS: [
      // Only basic text formatting
      "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "del", "ins",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "dl", "dt", "dd",
      "code", "pre", "kbd", "samp", "var",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
      "blockquote", "cite",
      "hr", "sub", "sup", "small", "mark", "time", "abbr", "acronym", "dfn"
    ],
    ALLOWED_ATTR: [
      // Only safe attributes
      "id", "class", "style", "title", "lang", "dir",
      "colspan", "rowspan", "scope", "headers",
      "datetime"
    ],
    // Disable all potentially dangerous content
    FORBID_TAGS: ["script", "object", "embed", "form", "input", "textarea", "select", "button", "iframe", "img", "a", "link", "meta", "style"],
    FORBID_ATTR: [
      "onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur",
      "onchange", "onsubmit", "onreset", "onselect", "onunload", "onabort", "onbeforeunload",
      "onerror", "onhashchange", "onmessage", "onoffline", "ononline", "onpagehide",
      "onpageshow", "onpopstate", "onresize", "onstorage", "oncontextmenu", "onkeydown",
      "onkeypress", "onkeyup", "onmousedown", "onmousemove", "onmouseup", "onwheel",
      "oncopy", "oncut", "onpaste", "onselectstart", "onbeforecopy", "onbeforecut",
      "onbeforepaste", "onbeforeprint", "onafterprint", "onbeforeeditfocus",
      "onactivate", "onbeforeactivate", "onbeforedeactivate", "ondeactivate",
      "onfocusin", "onfocusout", "onhelp", "onmouseenter", "onmouseleave",
      "onmousewheel", "onmove", "onmoveend", "onmovestart", "onpropertychange",
      "onreadystatechange", "onrowsdelete", "onrowsinserted", "onstop", "onlosecapture",
      "href", "src", "data", "action", "method", "target", "rel"
    ],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  };

  return DOMPurify.sanitize(html, attachmentOptions);
}; 