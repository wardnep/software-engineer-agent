import "dotenv/config";

import { readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";

// Workspace root
const workspaceRoot = process.cwd();

// Tool: List files
const listFilesTool = tool({
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

// Agent
const agent = new Agent({
  name: "Software Engineer",

  instructions: `
    You are an experienced software engineer.

    You can inspect project structure using available tools.

    When asked about project files or directories,
    you MUST use the list_files tool.

    Never assume files exist without inspecting them.

    Explain your findings clearly.
  `,

  model: "gpt-5.4",

  tools: [listFilesTool],
});

// Main
async function main() {
  try {
    const result = await run(
      agent,
      "Inspect the src directory using your list_files tool and explain its structure."
    );

    console.log("\nAgent Response:\n");
    console.log(result.finalOutput);

  } catch (error: unknown) {
    console.error("\nAgent Execution Failed!");

    console.dir(error, { depth: 5 });
    process.exitCode = 1;
  }
}

void main();
