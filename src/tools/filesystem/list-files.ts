import { readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { tool } from "@openai/agents";
import { z } from "zod";

import { workspaceRoot } from "../../config/workspace.js";

export const listFilesTool = tool({
  name: "list_files",

  description:
    "List files and directories inside the project workspace. Use this tool when you need to inspect project structure.",

  parameters: z.object({
    directory: z
      .string()
      .describe("Relative directory path inside the workspace."),
  }),

  async execute({ directory }) {
    const targetPath = resolve(workspaceRoot, directory);
    const relativePath = relative(workspaceRoot, targetPath);

    // Security: prevent accessing outside workspace
    if (
      relativePath.startsWith("..") ||
      isAbsolute(relativePath)
    ) {
      return JSON.stringify({
        error: "Access denied: outside workspace.",
      });
    }

    try {
      const entries = await readdir(targetPath, {
        withFileTypes: true,
      });

      return JSON.stringify({
        directory: relativePath || ".",
        entries: entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory()
            ? "directory"
            : entry.isFile()
              ? "file"
              : entry.isSymbolicLink()
                ? "symlink"
                : "other",
        })),
      }, null, 2);

    } catch (error: unknown) {
      return JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown filesystem error",
      });
    }
  },
});
