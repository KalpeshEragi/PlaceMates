// ────────────────────────────────────────────────────────────
// LinkedIn Courses Extractor
// Reads Courses.csv from the stored LinkedIn ZIP on the fly.
// ────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { prisma } from "../../lib/prisma";

export interface ParsedCourse {
    name: string;
    number: string;
}

/**
 * Extract courses from the user's stored LinkedIn ZIP.
 * Returns an empty array if the ZIP is missing or cannot be parsed.
 */
export async function extractCoursesFromZip(
    userId: string
): Promise<ParsedCourse[]> {
    try {
        const user = await prisma.userAuth.findUnique({
            where: { id: userId },
            select: { linkedinZipPath: true },
        });

        if (!user?.linkedinZipPath) return [];

        const absoluteZipPath = path.resolve(process.cwd(), user.linkedinZipPath);
        if (!fs.existsSync(absoluteZipPath)) return [];

        const zip = new AdmZip(absoluteZipPath);
        const entries = zip.getEntries();

        // Find Courses.csv (may be nested inside a folder)
        const coursesEntry = entries.find((e) =>
            e.entryName.toLowerCase().endsWith("courses.csv")
        );

        if (!coursesEntry) return [];

        const csvContent = coursesEntry.getData().toString("utf-8");

        const rows: Record<string, string>[] = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true,
        });

        return rows.map((row) => ({
            name: col(row, "Name", "Course Name", "Title") || "",
            number: col(row, "Number", "Course Number", "Code") || "",
        })).filter((c) => c.name);
    } catch (err) {
        console.warn("Failed to extract courses from ZIP:", err);
        return [];
    }
}

/**
 * Case-insensitive column lookup (LinkedIn headers vary).
 */
function col(
    row: Record<string, string>,
    ...candidates: string[]
): string | undefined {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
        const found = keys.find((k) => k.toLowerCase() === candidate.toLowerCase());
        if (found && row[found]) return row[found];
    }
    return undefined;
}
