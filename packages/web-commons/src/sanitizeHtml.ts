import xss from "xss";

export const sanitizeHtml = (html: string) => {
  return xss(html, {
    stripIgnoreTagBody: ["script"],
    whiteList: {
      div: ["style"],
      span: ["style"],
    },
    css: true,
  });
};
