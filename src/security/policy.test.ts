
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  resolveReadableFile,
} from "./policy.js";

describe("Security Policy", () => {
  let workspaceRoot: string;
  let outsideRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(
      join(tmpdir(), "agent-workspace-"),
    );

    outsideRoot = await mkdtemp(
      join(tmpdir(), "agent-outside-"),
    );
  });

  afterEach(async () => {
    await rm(workspaceRoot, {
      recursive: true,
      force: true,
    });

    await rm(outsideRoot, {
      recursive: true,
      force: true,
    });
  });

  it("allows reading a normal source file", async () => {
    await mkdir(join(workspaceRoot, "src"));

    await writeFile(
      join(workspaceRoot, "src", "index.ts"),
      "console.log('hello');",
    );

    const result = await resolveReadableFile(
      workspaceRoot,
      "src/index.ts",
    );

    expect(result.relativePath).toBe(
      join("src", "index.ts"),
    );
  });

  it("blocks path traversal", async () => {
    await expect(
      resolveReadableFile(
        workspaceRoot,
        "../../etc/passwd",
      ),
    ).rejects.toThrow("outside workspace");
  });

  it("blocks absolute paths", async () => {
    await expect(
      resolveReadableFile(
        workspaceRoot,
        "/etc/passwd",
      ),
    ).rejects.toThrow("Absolute paths");
  });

  it("blocks .env files", async () => {
    await writeFile(
      join(workspaceRoot, ".env"),
      "SECRET=123456",
    );

    await expect(
      resolveReadableFile(
        workspaceRoot,
        ".env",
      ),
    ).rejects.toThrow("sensitive file");
  });

  it("blocks private key files", async () => {
    await writeFile(
      join(workspaceRoot, "id_rsa.pem"),
      "PRIVATE KEY",
    );

    await expect(
      resolveReadableFile(
        workspaceRoot,
        "id_rsa.pem",
      ),
    ).rejects.toThrow("sensitive file");
  });

  it("blocks symlinks pointing outside workspace", async () => {
    await writeFile(
      join(outsideRoot, "secret.txt"),
      "TOP SECRET",
    );

    await symlink(
      join(outsideRoot, "secret.txt"),
      join(workspaceRoot, "secret-link"),
    );

    await expect(
      resolveReadableFile(
        workspaceRoot,
        "secret-link",
      ),
    ).rejects.toThrow("symlink points outside workspace");
  });

  it("blocks directories", async () => {
    await mkdir(join(workspaceRoot, "src"));

    await expect(
      resolveReadableFile(
        workspaceRoot,
        "src",
      ),
    ).rejects.toThrow("Only regular files");
  });

  it("blocks files larger than the size limit", async () => {
    const largeContent = "A".repeat(300 * 1024);

    await writeFile(
      join(workspaceRoot, "large.txt"),
      largeContent,
    );

    await expect(
      resolveReadableFile(
        workspaceRoot,
        "large.txt",
      ),
    ).rejects.toThrow("maximum allowed size");
  });
});
