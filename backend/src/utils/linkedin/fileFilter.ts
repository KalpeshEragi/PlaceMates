// ────────────────────────────────────────────────────────────
// LinkedIn Import — Filename-based file filter / allowlist
// ────────────────────────────────────────────────────────────
//
// LinkedIn data exports contain many files we don't need
// (messages, ads, invitations, etc.). This module checks
// each filename against an allowlist and returns its category.
// ────────────────────────────────────────────────────────────

import path from "path";
import type { LinkedInCategory } from "./types.js";

/**
 * Maps a lowercase filename substring → category in our schema.
 * Order matters — first match wins.
 */
const FILENAME_CATEGORY_MAP: { pattern: string; category: LinkedInCategory }[] = [
    // Profile / Identity
    { pattern: "profile", category: "personal" },

    // About / Summary (must be checked before generic "profile" already matched)
    { pattern: "summary", category: "about" },

    // Experience
    { pattern: "positions", category: "experience" },
    { pattern: "experience", category: "experience" },

    // Education
    { pattern: "education", category: "education" },

    // Skills
    { pattern: "skills", category: "skills" },

    // Projects
    { pattern: "projects", category: "projects" },

    // Certifications
    { pattern: "certifications", category: "certifications" },
    { pattern: "licenses", category: "certifications" },

    // Honors / Awards
    { pattern: "honors", category: "awards" },
    { pattern: "awards", category: "awards" },

    // Contact
    { pattern: "email", category: "emails" },
    { pattern: "phone", category: "phones" },

    // Rich Media
    { pattern: "rich media", category: "media" },
    { pattern: "media", category: "media" },
];

/**
 * File extensions we can actually parse.
 */
const PARSEABLE_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);

/**
 * Check whether a file should be processed.
 *
 * @returns the category string, or `null` if the file should be skipped.
 */
export function classifyFile(filePath: string): LinkedInCategory | null {
    const ext = path.extname(filePath).toLowerCase();
    if (!PARSEABLE_EXTENSIONS.has(ext)) return null;

    const basename = path.basename(filePath, ext).toLowerCase();

    for (const { pattern, category } of FILENAME_CATEGORY_MAP) {
        if (basename.includes(pattern)) {
            return category;
        }
    }

    return null; // not in our allowlist → skip
}

/**
 * Returns true when the file extension is .csv
 */
export function isCsv(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".csv";
}

/**
 * Returns true when the file extension is .xlsx or .xls
 */
export function isExcel(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".xlsx" || ext === ".xls";
}
