import { defaultTasksConfig } from "@allurereport/common-config";
import { defineConfig } from "vite-plus";

export default defineConfig(defaultTasksConfig(import.meta.dirname));
