export const proseStyles = `
html, body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: hidden;
  background: var(--bg-base-primary);
}

body {
  color: var(--on-text-primary);
  font-family: var(--font-family);
  font-size: var(--font-size-m);
  line-height: var(--line-height-m);
}

p {
  margin-bottom: 10px;
}

p:last-child {
  margin-bottom: 0;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: var(--font-weight-bold) !important;
  line-height: var(--line-height-l) !important;
  margin: 16px 0 10px;
}

h1:first-child,
h2:first-child,
h3:first-child,
h4:first-child,
h5:first-child,
h6:first-child {
  margin-top: 0;
}

h1 {
  font-size: var(--font-size-xl) !important;
}

h2,
h3 {
  font-size: var(--font-size-l) !important;
}

h4 {
  font-size: var(--font-size-m) !important;
}

h5,
h6 {
  font-size: var(--font-size-s) !important;
}

h6 {
  color: var(--on-text-secondary);
}

strong,
b {
  font-weight: var(--font-weight-bold) !important;
}

em,
i {
  font-style: italic !important;
}

del,
s {
  text-decoration: line-through;
}

a {
  color: var(--on-text-primary);
  text-decoration: underline;
}

a:hover {
  color: var(--on-text-secondary);
}

code {
  font-family: var(--font-family-mono) !important;
  font-size: var(--font-size-m-code) !important;
  padding: 0.2em 0.4em;
  background: var(--bg-control-secondary);
  border-radius: 4px;
}

pre {
  font-family: var(--font-family-mono) !important;
  font-size: var(--font-size-s) !important;
  line-height: 1.45 !important;
  padding: 16px;
  overflow: auto;
  background: var(--bg-control-secondary);
  border-radius: 6px;
  margin-bottom: 16px;
}

pre code {
  padding: 0;
  background: transparent;
  font-size: inherit !important;
  border-radius: 0;
}

blockquote {
  padding: 0 1em;
  border-left: 0.25em solid var(--on-border-primary);
  color: var(--on-text-secondary);
  margin-bottom: 16px;
}

ul,
ol {
  padding-left: 2em;
  margin-bottom: 10px;
}

ul {
  list-style: disc !important;
}

ol {
  list-style: decimal !important;
}

li + li {
  margin-top: 0.25em;
}

hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: var(--on-border-primary);
  border: 0 !important;
}

table {
  border-spacing: 0;
  border-collapse: collapse;
  margin-bottom: 16px;
  display: block;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  transform: translateZ(0);
  contain: layout paint;
}

th,
td {
  padding: 6px 13px;
  border: 1px solid var(--on-border-primary) !important;
  white-space: nowrap;
}

th {
  font-weight: var(--font-weight-bold) !important;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-base-primary);
}

tr:nth-child(2n) {
  background: var(--bg-control-secondary);
}

img {
  max-width: 100% !important;
  height: auto !important;
  display: inline-block !important;
  vertical-align: middle !important;
}

abbr,
abbr[title] {
  text-decoration: underline dotted;
  cursor: help;
  border-bottom: none;
}

kbd {
  display: inline-block;
  padding: 3px 5px;
  font-family: var(--font-family-mono) !important;
  font-size: 11px;
  line-height: 10px;
  color: var(--on-text-primary);
  vertical-align: middle;
  background-color: var(--bg-control-secondary);
  border: solid 1px var(--on-border-medium);
  border-bottom-color: var(--on-border-medium);
  border-radius: 6px;
  box-shadow: inset 0 -1px 0 var(--on-border-medium);
}

samp {
  font-family: var(--font-family-mono) !important;
  font-size: 85% !important;
}

var {
  font-family: var(--font-family-mono) !important;
  font-style: italic !important;
  font-weight: var(--font-weight-bold) !important;
}

mark {
  background-color: var(--bg-support-aldebaran);
  color: var(--on-text-primary);
  padding: 0.1em 0.2em;
  border-radius: 2px;
}

small {
  font-size: 85% !important;
}

sub,
sup {
  font-size: 75% !important;
  line-height: 0 !important;
  position: relative !important;
  vertical-align: baseline !important;
}

sub {
  bottom: -0.25em !important;
}

sup {
  top: -0.5em !important;
}

ins {
  text-decoration: underline;
  background-color: var(--bg-support-gliese);
  color: var(--on-text-primary);
  text-decoration-color: var(--on-support-gliese);
}

dfn {
  font-style: italic !important;
  font-weight: var(--font-weight-bold) !important;
}

cite {
  font-style: italic !important;
}

q {
  font-style: italic !important;
}

q::before {
  content: open-quote;
}

q::after {
  content: close-quote;
}

time {
  font-variant-numeric: tabular-nums;
}

dl {
  padding: 0;
  margin-bottom: 16px;
}

dt {
  padding: 0;
  margin-top: 16px;
  font-size: 1em;
  font-style: italic;
  font-weight: var(--font-weight-bold) !important;
}

dt:first-child {
  margin-top: 0;
}

dd {
  padding: 0 0 0 16px;
  margin-left: 0;
  margin-bottom: 16px;
}

figure {
  margin: 16px 0;
  display: block;
}

figcaption {
  margin-top: 8px;
  font-size: var(--font-size-s) !important;
  color: var(--on-text-secondary);
  font-style: italic;
  text-align: center;
}

details {
  display: block;
  margin-bottom: 16px;
}

summary {
  display: list-item;
  cursor: pointer;
  font-weight: var(--font-weight-bold) !important;
  margin-bottom: 8px;
}

summary:hover {
  color: var(--on-text-secondary);
}

summary::marker {
  color: var(--on-text-secondary);
}

details[open] summary {
  margin-bottom: 16px;
}

article,
section,
aside,
nav {
  display: block;
  margin-bottom: 16px;
}

header,
footer {
  display: block;
  margin-bottom: 16px;
}

address {
  display: block;
  font-style: italic;
  margin-bottom: 16px;
}
`;

const CSS_VAR_PATTERN = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g;

const resolveCssValue = (value: string, rootStyles: CSSStyleDeclaration, visitedVars: Set<string>): string => {
  return value.replace(CSS_VAR_PATTERN, (_, variableName: string, fallback: string | undefined) => {
    if (visitedVars.has(variableName)) {
      return fallback ? resolveCssValue(fallback.trim(), rootStyles, visitedVars) : "";
    }

    const nextVisited = new Set(visitedVars);
    nextVisited.add(variableName);

    const variableValue = rootStyles.getPropertyValue(variableName).trim();

    if (variableValue) {
      return resolveCssValue(variableValue, rootStyles, nextVisited);
    }

    return fallback ? resolveCssValue(fallback.trim(), rootStyles, nextVisited) : "";
  });
};

export const resolveCssVarDeclarations = (cssText: string) => {
  if (typeof globalThis === "undefined" || !globalThis.document) {
    return "";
  }

  const rootStyles = globalThis.getComputedStyle(globalThis.document.documentElement);
  const variableNames = Array.from(new Set(cssText.match(/--[\w-]+/g) ?? []));

  return variableNames
    .map((name) => {
      const rawValue = rootStyles.getPropertyValue(name).trim();
      const value = resolveCssValue(rawValue, rootStyles, new Set([name])).trim();
      return value ? `${name}: ${value};` : "";
    })
    .filter(Boolean)
    .join("\n");
};
