import Prism from "prismjs";

(globalThis as typeof globalThis & { Prism: typeof Prism }).Prism = Prism;
