#!/usr/bin/env node
import { argv } from "node:process";
import run from "./dist/index.js";

run(argv.slice(2).join(" "));
