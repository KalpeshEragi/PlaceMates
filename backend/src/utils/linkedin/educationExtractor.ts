// ────────────────────────────────────────────────────────────
// LinkedIn Education Extractor
// Reads Education.csv from the stored LinkedIn ZIP on the fly.
// ────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { prisma } from "../../lib/prisma";

export interface ParsedEducation {
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    activities: string;
}

/**
 * Extract education entries from the user's stored LinkedIn ZIP.
 * Returns an empty array if the ZIP is missing or cannot be parsed.
 */
export async function extractEducationFromZip(
    userId: string
): Promise<ParsedEducation[]> {
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

        // Find Education.csv (may be nested inside a folder)
        const eduEntry = entries.find((e) =>
            e.entryName.toLowerCase().endsWith("education.csv")
        );

        if (!eduEntry) return [];

        const csvContent = eduEntry.getData().toString("utf-8");

        const rows: Record<string, string>[] = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true,
        });

        return rows.map((row) => ({
            institution: col(row, "School Name", "Institution Name", "School") || "",
            degree: col(row, "Degree Name", "Degree") || "",
            field: col(row, "Notes", "Field of Study", "Field Of Study") || "",
            startDate: col(row, "Start Date", "Started On") || "",
            endDate: col(row, "End Date", "Finished On") || "",
            activities: col(row, "Activities and Societies", "Activities") || "",
        })).filter((e) => e.institution);
    } catch (err) {
        console.warn("Failed to extract education from ZIP:", err);
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
