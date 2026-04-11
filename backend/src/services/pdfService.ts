/**
 * pdfService.ts
 *
 * Generates a PDF buffer from HTML using Puppeteer (headless Chrome).
 */

import puppeteer from "puppeteer";
import { buildResumeHTML, ResumeData } from "./resumeTemplate";

/**
 * Takes structured resume data, builds HTML, and renders it to a PDF buffer.
 */
export async function generateResumePDF(resumeData: ResumeData): Promise<Buffer> {
  const html = buildResumeHTML(resumeData);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // Puppeteer returns Uint8Array — convert to Node Buffer
    return Buffer.from(pdfUint8Array);
  } finally {
    await browser.close();
  }
}
