import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname= dirname(fileURLToPath(import.meta.url));
const __root = path.resolve(__dirname, "..");

export function root(args) {
  args = Array.prototype.slice.call(arguments, 0);
  return path.join.apply(path, [__root].concat(args));
}
