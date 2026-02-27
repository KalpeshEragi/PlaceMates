// ────────────────────────────────────────────────────────────
// LinkedIn Import — Orchestration Service
// ────────────────────────────────────────────────────────────
//
// Pipeline:  ZIP → extract → filter → parse → map → save → cleanup
// ────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { classifyFile, isCsv, isExcel } from "../utils/linkedin/fileFilter.js";
import { parseCsvFile } from "../utils/linkedin/csvParser.js";
import { parseExcelFile } from "../utils/linkedin/xlsxParser.js";
import { mapToLinkedInProfile } from "../utils/linkedin/dataMapper.js";
import type { ParsedFile, LinkedInProfile } from "../utils/linkedin/types.js";

/**
 * Process a LinkedIn data export ZIP file and save the
 * extracted profile data to the user's profile.
 *
 * @param zipPath  - Absolute path to the uploaded ZIP file
 * @param userId   - Authenticated user's ID
 * @returns The mapped LinkedIn profile + import metadata
 */
export async function processLinkedInZip(
    zipPath: string,
    userId: string
): Promise<{
    linkedInProfile: LinkedInProfile;
    filesProcessed: string[];
    filesSkipped: string[];
}> {
    // ── 1. Create temp directory for extraction ──────────────
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "placemates-linkedin-")
    );

    const filesProcessed: string[] = [];
    const filesSkipped: string[] = [];

    try {
        // ── 2. Extract ZIP ──────────────────────────────────────
        console.log(`[LinkedIn Import] Extracting ZIP to ${tempDir}`);

        let zip: AdmZip;
        try {
            zip = new AdmZip(zipPath);
        } catch {
            throw new Error("Invalid or corrupted ZIP file");
        }

        zip.extractAllTo(tempDir, /*overwrite*/ true);

        // ── 3. Walk extracted files ─────────────────────────────
        const allFiles = walkDir(tempDir);
        console.log(`[LinkedIn Import] Found ${allFiles.length} file(s) in ZIP`);

        // ── 4. Filter + Parse ───────────────────────────────────
        const parsedFiles: ParsedFile[] = [];

        for (const filePath of allFiles) {
            const category = classifyFile(filePath);

            if (!category) {
                filesSkipped.push(path.relative(tempDir, filePath));
                continue;
            }

            try {
                let rows: Record<string, string>[];

                if (isCsv(filePath)) {
                    rows = await parseCsvFile(filePath);
                } else if (isExcel(filePath)) {
                    rows = parseExcelFile(filePath);
                } else {
                    filesSkipped.push(path.relative(tempDir, filePath));
                    continue;
                }

                if (rows.length > 0) {
                    parsedFiles.push({ category, rows });
                    filesProcessed.push(path.relative(tempDir, filePath));
                    console.log(
                        `[LinkedIn Import]   ✅ ${path.basename(filePath)} → "${category}" (${rows.length} rows)`
                    );
                }
            } catch (err) {
                // Partial import — log but continue
                console.warn(
                    `[LinkedIn Import]   ⚠️  Failed to parse ${path.basename(filePath)}:`,
                    (err as Error).message
                );
                filesSkipped.push(path.relative(tempDir, filePath));
            }
        }

        if (parsedFiles.length === 0) {
            throw new Error(
                "No processable LinkedIn profile files found in the ZIP. " +
                "Make sure the ZIP contains CSV/XLSX files from your LinkedIn data export."
            );
        }

        // ── 5. Map to unified schema ────────────────────────────
        const linkedInProfile = mapToLinkedInProfile(parsedFiles);
        console.log("[LinkedIn Import] Mapping complete");

        // ── 6. Save to database (merge with existing) ───────────
        await saveLinkedInProfile(userId, linkedInProfile);
        console.log("[LinkedIn Import] Saved to database");

        return { linkedInProfile, filesProcessed, filesSkipped };
    } finally {
        // ── 7. Cleanup temp files ───────────────────────────────
        cleanup(tempDir);
        cleanup(zipPath);
    }
}

// ── Save to DB (merge strategy) ────────────────────────────

async function saveLinkedInProfile(
    userId: string,
    linkedInProfile: LinkedInProfile
): Promise<void> {
    // Get the existing profile
    const profile = await prisma.userProfile.findUnique({
        where: { userId },
    });

    const existingData = (profile?.importedData as Record<string, unknown>) || {};

    // Merge: keep other keys (e.g. githubRepos), replace linkedin section
    // JSON roundtrip ensures Prisma-compatible InputJsonValue
    const merged = JSON.parse(JSON.stringify({
        ...existingData,
        linkedInProfile,
        linkedInImportedAt: new Date().toISOString(),
    })) as Prisma.InputJsonValue;

    await prisma.userProfile.update({
        where: { userId },
        data: {
            importedData: merged,
        },
    });
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Recursively list all files in a directory.
 */
function walkDir(dir: string): string[] {
    const files: string[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkDir(fullPath));
        } else {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Safely delete a file or directory tree.
 */
function cleanup(target: string): void {
    try {
        if (fs.existsSync(target)) {
            const stat = fs.statSync(target);
            if (stat.isDirectory()) {
                fs.rmSync(target, { recursive: true, force: true });
            } else {
                fs.unlinkSync(target);
            }
            console.log(`[LinkedIn Import] 🗑️  Cleaned up ${target}`);
        }
    } catch (err) {
        console.warn(`[LinkedIn Import] Cleanup warning: ${(err as Error).message}`);
    }
}
