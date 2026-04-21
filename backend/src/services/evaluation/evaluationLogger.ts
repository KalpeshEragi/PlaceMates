/**
 * evaluationLogger.ts
 *
 * Research Evaluation: Structured logging utility.
 *
 * Provides structured log output for the research evaluation pipeline
 * with console output and optional file logging for paper documentation.
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ── Types ──────────────────────────────────────────────────

interface EvalConfig {
  evalUsers: number;
  evalTopK: number;
  evalIterations: number;
  useRag: boolean;
  useCritic: boolean;
  useIteration: boolean;
}

interface UserScoreLog {
  userId: string;
  semanticPrecision: number;
  keywordPrecision: number;
  baseScore: number | null;
  finalScore: number | null;
}

// ── Log File Setup ─────────────────────────────────────────

const LOG_DIR = join(process.cwd(), "evaluation-output");
const LOG_FILE = join(LOG_DIR, "evaluation-results.log");

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeLog(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  // Console
  console.log(`[EVAL] ${message}`);

  // File
  try {
    ensureLogDir();
    appendFileSync(LOG_FILE, line);
  } catch {
    // File logging is best-effort — don't crash evaluation
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Log evaluation start with configuration details.
 */
export function logEvalStart(config: EvalConfig): void {
  writeLog("════════════════════════════════════════════════════════");
  writeLog("EVALUATION STARTED");
  writeLog("════════════════════════════════════════════════════════");
  writeLog(`  Users:      ${config.evalUsers}`);
  writeLog(`  Top-K:      ${config.evalTopK}`);
  writeLog(`  Iterations: ${config.evalIterations}`);
  writeLog(`  USE_RAG:       ${config.useRag}`);
  writeLog(`  USE_CRITIC:    ${config.useCritic}`);
  writeLog(`  USE_ITERATION: ${config.useIteration}`);
  writeLog("────────────────────────────────────────────────────────");
}

/**
 * Log evaluation completion with timing.
 */
export function logEvalComplete(durationMs: number, userCount: number): void {
  const durationSec = (durationMs / 1000).toFixed(2);
  writeLog("────────────────────────────────────────────────────────");
  writeLog(`EVALUATION COMPLETED`);
  writeLog(`  Users Evaluated: ${userCount}`);
  writeLog(`  Duration:        ${durationSec}s`);
  writeLog("════════════════════════════════════════════════════════");
}

/**
 * Log per-user scores.
 */
export function logUserScore(log: UserScoreLog): void {
  writeLog(
    `  User ${log.userId.slice(0, 8)}... | ` +
    `Semantic P@K: ${log.semanticPrecision.toFixed(4)} | ` +
    `Keyword P@K: ${log.keywordPrecision.toFixed(4)} | ` +
    `ATS: ${log.baseScore ?? "N/A"} → ${log.finalScore ?? "N/A"}`
  );
}

/**
 * Log ablation mode activation.
 */
export function logAblationMode(mode: string): void {
  writeLog(`⚗️  ABLATION MODE: ${mode.toUpperCase()}`);
  switch (mode) {
    case "no_rag":
      writeLog("   → Retriever DISABLED (zero-shot drafting)");
      break;
    case "no_critic":
      writeLog("   → Critic DISABLED (accepting first draft)");
      break;
    case "no_iteration":
      writeLog("   → Iteration DISABLED (single pass only)");
      break;
    case "full":
      writeLog("   → All components ENABLED");
      break;
    default:
      writeLog(`   → Custom mode: ${mode}`);
  }
}

/**
 * Log a section header.
 */
export function logSection(title: string): void {
  writeLog(`\n── ${title} ────────────────────────────────`);
}

/**
 * Print a formatted table to console and log file.
 */
export function logTable(
  headers: string[],
  rows: string[][],
  title?: string,
): void {
  if (title) {
    writeLog(`\n${title}`);
  }

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxData = Math.max(...rows.map((r) => (r[i] || "").length));
    return Math.max(h.length, maxData) + 2;
  });

  // Header
  const headerLine = headers
    .map((h, i) => h.padEnd(colWidths[i]))
    .join("| ");
  const separator = colWidths.map((w) => "─".repeat(w)).join("┼─");

  writeLog(headerLine);
  writeLog(separator);

  // Rows
  for (const row of rows) {
    const line = row
      .map((cell, i) => (cell || "").padEnd(colWidths[i]))
      .join("| ");
    writeLog(line);
  }
}

/**
 * Write the final JSON report to a file.
 */
export function writeJsonReport(data: any, filename: string = "evaluation-results.json"): string {
  ensureLogDir();
  const filepath = join(LOG_DIR, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2));
  writeLog(`📄 JSON report written to: ${filepath}`);
  return filepath;
}
