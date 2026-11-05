import { resolve } from "node:path";

// Root directory that the Agent is allowed to access.
export const workspaceRoot = resolve(process.cwd());
