// ────────────────────────────────────────────────────────────
// LinkedIn Position Extractor
// Reads Positions.csv from the stored LinkedIn ZIP on the fly.
// ────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { prisma } from "../../lib/prisma";

export interface ParsedPosition {
    company: string;
    title: string;
    location: string;
    start: string;
    end: string;
    description: string;
}

/**
 * Extract positions from the user's stored LinkedIn ZIP.
 * Returns an empty array if the ZIP is missing or cannot be parsed.
 */
export async function extractPositionsFromZip(
    userId: string
): Promise<ParsedPosition[]> {
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

        // Find Positions.csv (may be nested inside a folder)
        const positionsEntry = entries.find((e) =>
            e.entryName.toLowerCase().endsWith("positions.csv")
        );

        if (!positionsEntry) return [];

        const csvContent = positionsEntry.getData().toString("utf-8");

        const rows: Record<string, string>[] = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true,
        });

        return rows.map((row) => ({
            company: col(row, "Company Name", "company name", "Company") || "",
            title: col(row, "Title", "title", "Position") || "",
            location: col(row, "Location", "location") || "",
            start: col(row, "Started On", "Start Date", "start date") || "",
            end: col(row, "Finished On", "End Date", "end date") || "",
            description: col(row, "Description", "description") || "",
        }));
    } catch (err) {
        console.warn("Failed to extract positions from ZIP:", err);
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
