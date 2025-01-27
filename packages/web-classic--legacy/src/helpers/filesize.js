import { filesize } from "filesize";

export default function (size) {
  if (!size) {
    return "";
  }
  return filesize(size, { base: 2, round: 1 });
}
