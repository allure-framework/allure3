import i18next from "@/utils/translation.js";

export default function translate(key, options) {
  return i18next.t(key, options ? options.hash : {});
}
