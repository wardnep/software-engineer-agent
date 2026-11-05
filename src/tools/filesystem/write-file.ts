
import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { tool } from "@openai/agents";
import { z } from "zod";

import {
  resolveWritableFile,
} from "../../security/policy.js";

const MAX_WRITE_SIZE = 256 * 1024;

export async function createWorkspaceFile(
  workspaceRoot: string,
  path: string,
  content: string,
) {
  if (
    Buffer.byteLength(content, "utf8") >
    MAX_WRITE_SIZE
  ) {
    throw new Error(
      "Content exceeds the maximum allowed size.",
    );
  }

  const file = await resolveWritableFile(
    workspaceRoot,
    path,
  );

  let fileHandle;

  try {
    fileHandle = await open(
      file.absolutePath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );

    await fileHandle.writeFile(content, "utf8");

    return {
      success: true,
      path: file.relativePath,
      size: Buffer.byteLength(content, "utf8"),
    };

  } finally {
    await fileHandle?.close();
  }
}

export function createWriteFileTool(
  workspaceRoot: string,
) {
  return tool({
    name: "write_file",

    description:
      "Create a new text file inside the project workspace. Never overwrites existing files.",

    parameters: z.object({
      path: z.string(),
      content: z.string(),
    }),

    async execute({ path, content }) {
      try {
        return JSON.stringify(
          await createWorkspaceFile(
            workspaceRoot,
            path,
            content,
          ),
        );

      } catch (error: unknown) {
        return JSON.stringify({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown file writing error",
        });
      }
    },
  });
}
