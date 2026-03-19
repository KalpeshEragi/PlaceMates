// ────────────────────────────────────────────────────────────
// LinkedIn Honors Extractor
// Reads Honors.csv from the stored LinkedIn ZIP on the fly.
// ────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { prisma } from "../../lib/prisma";

export interface ParsedHonor {
    title: string;
    issuer: string;
    date: string;
    description: string;
}

/**
 * Extract honors/awards from the user's stored LinkedIn ZIP.
 * Returns an empty array if the ZIP is missing or cannot be parsed.
 */
export async function extractHonorsFromZip(
    userId: string
): Promise<ParsedHonor[]> {
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

        // Find Honors.csv (may be nested inside a folder)
        const honorsEntry = entries.find((e) =>
            e.entryName.toLowerCase().endsWith("honors.csv")
        );

        if (!honorsEntry) return [];

        const csvContent = honorsEntry.getData().toString("utf-8");

        const rows: Record<string, string>[] = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true,
        });

        return rows.map((row) => ({
            title: col(row, "Title", "Honor Title", "Name") || "",
            issuer: col(row, "Issuer", "Issuing Organization", "Organization") || "",
            date: col(row, "Issue Date", "Date", "Issued On") || "",
            description: col(row, "Description", "description") || "",
        })).filter((h) => h.title);
    } catch (err) {
        console.warn("Failed to extract honors from ZIP:", err);
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
