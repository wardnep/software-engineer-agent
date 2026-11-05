import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { tool } from "@openai/agents";
import { z } from "zod";

import { workspaceRoot } from "../../config/workspace.js";

import {
  MAX_FILE_SIZE,
  resolveReadableFile,
} from "../../security/policy.js";

export const readFileTool = tool({
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
      const file = await resolveReadableFile(
        workspaceRoot,
        path,
      );

      fileHandle = await open(
        file.absolutePath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );

      const fileStat = await fileHandle.stat();

      if (!fileStat.isFile()) {
        throw new Error("Not a regular file.");
      }

      if (fileStat.size > MAX_FILE_SIZE) {
        throw new Error("File exceeds maximum size.");
      }

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

      if (contentBuffer.includes(0)) {
        throw new Error("Binary files are not supported.");
      }

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
