
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "vitest";

import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createWorkspaceFile,
} from "./write-file.js";

describe("write_file", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(
      join(tmpdir(), "agent-test-"),
    );
  });

  afterEach(async () => {
    await rm(workspace, {
      recursive: true,
      force: true,
    });
  });

  it("creates a new file", async () => {
    await mkdir(join(workspace, "src"));

    const result = await createWorkspaceFile(
      workspace,
      "src/hello.ts",
      "console.log('Hello Agent');",
    );

    const content = await readFile(
      join(workspace, "src/hello.ts"),
      "utf8",
    );

    expect(result.success).toBe(true);
    expect(content).toBe(
      "console.log('Hello Agent');",
    );
  });

  it("rejects an existing file without overwriting", async () => {
    await writeFile(
      join(workspace, "existing.ts"),
      "original content",
    );

    await expect(
      createWorkspaceFile(
        workspace,
        "existing.ts",
        "new content",
      ),
    ).rejects.toThrow();

    const content = await readFile(
      join(workspace, "existing.ts"),
      "utf8",
    );

    expect(content).toBe("original content");
  });

  it("blocks sensitive files", async () => {
    await expect(
      createWorkspaceFile(
        workspace,
        ".env",
        "SECRET=value",
      ),
    ).rejects.toThrow();
  });

  it("blocks path traversal", async () => {
    await expect(
      createWorkspaceFile(
        workspace,
        "../outside.txt",
        "content",
      ),
    ).rejects.toThrow();
  });

  it("blocks absolute paths", async () => {
    await expect(
      createWorkspaceFile(
        workspace,
        join(workspace, "outside.txt"),
        "content",
      ),
    ).rejects.toThrow();
  });

  it("blocks oversized content", async () => {
    const content = "a".repeat(256 * 1024 + 1);

    await expect(
      createWorkspaceFile(
        workspace,
        "large.txt",
        content,
      ),
    ).rejects.toThrow(
      "Content exceeds the maximum allowed size.",
    );
  });

  it("rejects missing parent directories", async () => {
    await expect(
      createWorkspaceFile(
        workspace,
        "missing/file.ts",
        "content",
      ),
    ).rejects.toThrow();
  });
});
