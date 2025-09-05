/**
 * Static utilities for generating HTML tags and scripts
 * These utilities are safe to use in both Node.js and browser environments
 */

export const createBaseUrlScript = () => {
  return `<script>
    (function() {
      const base = document.createElement('base');
      base.href = document.querySelector('base')?.href || window.location.href;
      document.head.appendChild(base);
    })();
  </script>`;
};

export const createFaviconLinkTag = (href: string) => {
  return `<link rel="icon" type="image/x-icon" href="${href}">`;
};

export const createScriptTag = (src: string) => {
  return `<script src="${src}"></script>`;
};

export const createStylesLinkTag = (href: string) => {
  return `<link rel="stylesheet" href="${href}">`;
};