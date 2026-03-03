import fs from "fs";
import path from "path";

export type LocByLanguage = Record<string, number>;

const INCLUDE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".java",
  ".go",
  ".cpp",
  ".c",
  ".html",
  ".css",
  ".scss",
]);

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "vendor",
  ".git",
  "public", // handle public/generated below
]);

const EXCLUDED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

function isBinaryOrMinified(content: string): boolean {
  const sample = content.slice(0, 2000);
  if (sample.includes("\u0000")) return true;

  const lines = sample.split("\n");
  if (!lines.length) return false;

  const avgLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
  return avgLen > 300;
}

function languageFromExt(ext: string): string {
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "TypeScript";
    case ".js":
    case ".jsx":
      return "JavaScript";
    case ".py":
      return "Python";
    case ".java":
      return "Java";
    case ".go":
      return "Go";
    case ".cpp":
      return "C++";
    case ".c":
      return "C";
    case ".html":
      return "HTML";
    case ".css":
      return "CSS";
    case ".scss":
      return "SCSS";
    default:
      return ext.slice(1) || "unknown";
  }
}

export interface LocResult {
  totalLoc: number;
  locByLanguage: LocByLanguage;
}

export async function calculateRepositoryLoc(rootDir: string): Promise<LocResult> {
  let totalLoc = 0;
  const locByLanguage: LocByLanguage = {};

  async function walk(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        if (entry.name === "generated" && path.basename(path.dirname(fullPath)) === "public") {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (EXCLUDED_FILES.has(entry.name)) continue;

        const ext = path.extname(entry.name);
        if (!INCLUDE_EXTENSIONS.has(ext)) continue;

        const content = await fs.promises.readFile(fullPath, "utf8").catch(() => null);
        if (!content) continue;
        if (isBinaryOrMinified(content)) continue;

        const lines = content.split("\n");
        const nonEmpty = lines.filter((l) => l.trim().length > 0).length;
        if (!nonEmpty) continue;

        totalLoc += nonEmpty;
        const lang = languageFromExt(ext);
        locByLanguage[lang] = (locByLanguage[lang] || 0) + nonEmpty;
      }
    }
  }

  await walk(rootDir);

  return { totalLoc, locByLanguage };
}

