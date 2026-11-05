import "dotenv/config";

import { readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";

import { constants } from "node:fs";
import { open } from "node:fs/promises";

import {
  MAX_FILE_SIZE,
  resolveReadableFile,
} from "./security/policy.js";

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


const readFileTool = tool({
  name: "read_file",

  description:
    "Read a text source file inside the project workspace. Use this tool to inspect source code and configuration files. Never attempt to read sensitive files.",

  parameters: z.object({
    path: z
      .string()
      .describe("Relative file path inside the workspace."),
  }),

  async execute({ path }) {
    let fileHandle;

    try {
      // Step 1: Validate path and security policy
      const file = await resolveReadableFile(
        workspaceRoot,
        path,
      );

      // Step 2: Open file without following final symlink
      fileHandle = await open(
        file.absolutePath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );

      // Step 3: Verify the opened file
      const fileStat = await fileHandle.stat();

      if (!fileStat.isFile()) {
        throw new Error("Not a regular file.");
      }

      if (fileStat.size > MAX_FILE_SIZE) {
        throw new Error("File exceeds maximum size.");
      }

      // Step 4: Read at most MAX_FILE_SIZE + 1 bytes
      const buffer = Buffer.alloc(MAX_FILE_SIZE + 1);

      let offset = 0;

      while (offset < buffer.length) {
        const { bytesRead } = await fileHandle.read(
          buffer,
          offset,
          buffer.length - offset,
          offset,
        );

        if (bytesRead === 0) {
          break;
        }

        offset += bytesRead;
      }

      if (offset > MAX_FILE_SIZE) {
        throw new Error("File exceeds maximum size.");
      }

      const contentBuffer = buffer.subarray(0, offset);

      // Step 5: Reject binary files
      if (contentBuffer.includes(0)) {
        throw new Error("Binary files are not supported.");
      }

      // Step 6: Decode UTF-8 strictly
      const content = new TextDecoder("utf-8", {
        fatal: true,
      }).decode(contentBuffer);

      return JSON.stringify({
        path: file.relativePath,
        size: offset,
        content,
      });

    } catch (error: unknown) {
      return JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown file reading error",
      });

    } finally {
      await fileHandle?.close();
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

    When asked to inspect or understand file contents, you MUST use the read_file tool.
    Never invent file contents.

    If a file cannot be accessed, explain the error.
    Never attempt to bypass security restrictions.
  `,

  model: "gpt-5.4",

  tools: [
    listFilesTool,
    readFileTool
],
});

// Main
async function main() {
  try {
    // const result = await run(
    //   agent,
    //   "Inspect the src directory using your list_files tool and explain its structure."
    // );

    const result = await run(
      agent,
      "Read src/index.ts and explain how the list_files tool works."
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
