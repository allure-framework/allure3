import { extension as extensionFromContentType, lookup } from "mime-types";
import { extname } from "node:path";

export const extension = (fileName: string, contentType?: string) => {
  const ext = extname(fileName);
  if (ext !== "") {
    return ext;
  }
  if (contentType) {
    const result = extensionFromContentType(contentType);
    if (result === false) {
      return undefined;
    }
    return `.${result}`;
  }
  return undefined;
};

export const lookupContentType = (fileName: string) => {
  const res = lookup(fileName);
  if (res === false) {
    return undefined;
  }
  return res;
};
