// ────────────────────────────────────────────────────────────
// LinkedIn Import — XLSX / XLS parser
// ────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

/**
 * Parse an Excel file (.xlsx/.xls) into an array of key-value
 * row objects. Reads the first sheet only.
 *
 * @param filePath - absolute path to the Excel file
 * @returns array of rows, each row is Record<string, string>
 */
export function parseExcelFile(filePath: string): Record<string, string>[] {
    const workbook = XLSX.readFile(filePath, { type: "file" });

    // Use the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    // Convert to JSON — header: 1 means first row is headers
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: "",      // default value for empty cells
        raw: false,      // return strings, not numbers/dates
    });

    return rows;
}
