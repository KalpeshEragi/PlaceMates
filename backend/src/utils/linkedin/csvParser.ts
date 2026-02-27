// ────────────────────────────────────────────────────────────
// LinkedIn Import — CSV streaming parser
// ────────────────────────────────────────────────────────────

import fs from "fs";
import { parse } from "csv-parse";

/**
 * Parse a CSV file into an array of key-value row objects.
 * Uses a streaming parser so large files won't blow up memory.
 *
 * @param filePath - absolute path to the .csv file
 * @returns array of rows, each row is Record<string, string>
 */
export function parseCsvFile(filePath: string): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
        const rows: Record<string, string>[] = [];

        fs.createReadStream(filePath, { encoding: "utf-8" })
            .pipe(
                parse({
                    columns: true,          // first row = headers
                    skip_empty_lines: true,
                    trim: true,
                    relax_column_count: true, // tolerate ragged rows
                    bom: true,               // handle UTF-8 BOM from Excel/LinkedIn
                })
            )
            .on("data", (row: Record<string, string>) => {
                rows.push(row);
            })
            .on("end", () => resolve(rows))
            .on("error", (err: Error) => {
                // If the file is completely empty or un-parseable, return []
                if (rows.length > 0) {
                    resolve(rows);
                } else {
                    reject(new Error(`CSV parse error in ${filePath}: ${err.message}`));
                }
            });
    });
}
