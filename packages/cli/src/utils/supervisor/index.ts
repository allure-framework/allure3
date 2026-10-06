import process from "node:process";

import { PosixProcessSupervisor } from "./PosixProcessSupervisor.js";
import { WindowsProcessSupervisor } from "./windows/WindowsProcessSupervisor.js";

const ProcessSupervisor = process.platform === "win32" ? WindowsProcessSupervisor : PosixProcessSupervisor;

export type ProcessSupervisor = WindowsProcessSupervisor | PosixProcessSupervisor;
export type { ProcessCompletion, SupervisedCommandOptions } from "./model.js";
export { PosixProcessSupervisor, WindowsProcessSupervisor, ProcessSupervisor };
