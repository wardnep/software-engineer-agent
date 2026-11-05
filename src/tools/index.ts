import { workspaceRoot } from "../config/workspace.js";

import { listFilesTool } from "./filesystem/list-files.js";
import { readFileTool } from "./filesystem/read-file.js";
import { createWriteFileTool } from "./filesystem/write-file.js";

export const tools = [
  listFilesTool,
  readFileTool,
  createWriteFileTool(workspaceRoot),
];
