
import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  realpath,
  stat,
} from "node:fs/promises";

import { access } from "node:fs/promises";

export const MAX_FILE_SIZE = 256 * 1024; // 256 KB

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

// Check whether a path is inside another path.
function isPathInside(
  parent: string,
  target: string,
): boolean {
  const rel = relative(parent, target);

  return (
    rel === "" ||
    (
      rel !== ".." &&
      !rel.startsWith(`..${sep}`) &&
      !isAbsolute(rel)
    )
  );
}

// Files and directories that must never be read.
function isSensitivePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");
  const filename = segments.at(-1) ?? "";

  const blockedDirectories = [
    ".ssh",
    ".aws",
    ".gnupg",
  ];

  if (
    segments.some((segment) =>
      blockedDirectories.includes(segment)
    )
  ) {
    return true;
  }

  if (
    filename === ".env" ||
    filename.startsWith(".env.") ||
    filename.endsWith(".pem") ||
    filename.endsWith(".key") ||
    filename.endsWith(".p12") ||
    filename.endsWith(".pfx") ||
    filename.endsWith(".jks") ||
    filename.endsWith(".keystore")
  ) {
    return true;
  }

  return false;
}

// Resolve and validate a readable file.
export async function resolveReadableFile(
  workspaceRoot: string,
  requestedPath: string,
) {
  if (!requestedPath || requestedPath.includes("\0")) {
    throw new SecurityError("Invalid file path.");
  }

  if (isAbsolute(requestedPath)) {
    throw new SecurityError(
      "Absolute paths are not allowed.",
    );
  }

  const root = await realpath(workspaceRoot);
  const candidate = resolve(root, requestedPath);

  // Check lexical path.
  if (!isPathInside(root, candidate)) {
    throw new SecurityError(
      "Access denied: path is outside workspace.",
    );
  }

  // Check sensitive path before accessing it.
  if (isSensitivePath(relative(root, candidate))) {
    throw new SecurityError(
      "Access denied: sensitive file.",
    );
  }

  // Resolve symlinks and check the actual destination.
  const actualPath = await realpath(candidate);

  if (!isPathInside(root, actualPath)) {
    throw new SecurityError(
      "Access denied: symlink points outside workspace.",
    );
  }

  // Check sensitive path again after resolving symlinks.
  if (isSensitivePath(relative(root, actualPath))) {
    throw new SecurityError(
      "Access denied: sensitive file.",
    );
  }

  const fileStat = await stat(actualPath);

  if (!fileStat.isFile()) {
    throw new SecurityError(
      "Only regular files can be read.",
    );
  }

  if (fileStat.size > MAX_FILE_SIZE) {
    throw new SecurityError(
      "File exceeds the maximum allowed size.",
    );
  }

  return {
    absolutePath: actualPath,
    relativePath: relative(root, actualPath),
    size: fileStat.size,
  };
}

export async function resolveWritableFile(
  workspaceRoot: string,
  requestedPath: string,
) {
  if (!requestedPath || requestedPath.includes("\0")) {
    throw new SecurityError("Invalid file path.");
  }

  if (isAbsolute(requestedPath)) {
    throw new SecurityError(
      "Absolute paths are not allowed.",
    );
  }

  const root = await realpath(workspaceRoot);
  const candidate = resolve(root, requestedPath);

  if (!isPathInside(root, candidate)) {
    throw new SecurityError(
      "Access denied: path is outside workspace.",
    );
  }

  if (isSensitivePath(relative(root, candidate))) {
    throw new SecurityError(
      "Access denied: sensitive file.",
    );
  }

  // Parent directory must exist and resolve inside workspace.
  const parentPath = await realpath(
    resolve(candidate, ".."),
  );

  if (!isPathInside(root, parentPath)) {
    throw new SecurityError(
      "Access denied: parent directory is outside workspace.",
    );
  }

  if (isSensitivePath(relative(root, parentPath))) {
    throw new SecurityError(
      "Access denied: sensitive directory.",
    );
  }

  const filePath = resolve(parentPath, candidate.split(/[\\/]/).at(-1)!);

  if (!isPathInside(root, filePath)) {
    throw new SecurityError(
      "Access denied: invalid destination.",
    );
  }

  if (isSensitivePath(relative(root, filePath))) {
    throw new SecurityError(
      "Access denied: sensitive file.",
    );
  }

  try {
    await access(filePath);

    throw new SecurityError(
      "File already exists. Use edit_file instead.",
    );
  } catch (error: unknown) {
    if (error instanceof SecurityError) {
      throw error;
    }

    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      // File does not exist. This is expected.
    } else {
      throw error;
    }
  }

  return {
    absolutePath: filePath,
    relativePath: relative(root, filePath),
  };
}
