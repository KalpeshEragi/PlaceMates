/**
 * resumeTemplate.ts
 *
 * Builds a pixel-perfect HTML resume from tailored resume data.
 * Modeled after the Arjun Mehta two-column layout:
 *   Left  → Name, Summary, Experience, Projects
 *   Right → Contact, Skills, Education, Awards, Certifications
 */

export interface ResumeProfile {
  name: string;
  email: string;
  phone?: string;
  github?: string;
  linkedin?: string;
  location?: string;
}

export interface ResumeProject {
  name: string;
  techStack?: string[];
  bullets: string[];
}

export interface ResumeExperience {
  role: string;
  company: string;
  startDate: string;
  endDate?: string | null;
  bullets: string[];
}

export interface ResumeEducation {
  institution: string;
  degree: string;
  field?: string | null;
  startDate?: string;
  endDate?: string;
  gpa?: string | null;
}

export interface ResumeAward {
  title: string;
  issuedAt?: string;
}

export interface ResumeCertification {
  name: string;
  issuer?: string;
}

export interface ResumeData {
  professionalSummary: string;
  projects: ResumeProject[];
  experience: ResumeExperience[];
  skills: string[];
  education: ResumeEducation[];
  profile: ResumeProfile;
  awards?: ResumeAward[];
  certifications?: ResumeCertification[];
}

// ── Helpers ──────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Safely convert any value to a clean, displayable string.
 * Handles: null, undefined, "null", "undefined", objects, arrays.
 */
function safeStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Filter out literal "null" / "undefined" strings
    if (trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") return "";
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(safeStr).filter(Boolean).join(", ");
  if (typeof value === "object") {
    // Prevent [object Object] — try to extract common fields
    const obj = value as Record<string, unknown>;
    return safeStr(obj.name || obj.title || obj.text || obj.value || "");
  }
  return String(value);
}

function buildBulletList(bullets: unknown[]): string {
  if (!bullets || bullets.length === 0) return "";
  const safeBullets = bullets
    .map((b) => safeStr(b))
    .filter((b) => b.length > 0);
  if (safeBullets.length === 0) return "";
  return `<ul>${safeBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
}

/**
 * Formats a date range, handling null/empty/duplicate values.
 * Returns "" if no valid dates.
 */
function formatDateRange(start: unknown, end: unknown): string {
  const s = safeStr(start);
  const e = safeStr(end);

  if (!s && !e) return "";
  if (!s && e) return e;
  if (s && !e) return `${s} – Present`;
  // Avoid "2018 – 2018" duplicates
  if (s === e) return s;
  return `${s} – ${e}`;
}

/**
 * Formats GPA string, removing redundant "GPA:" prefix if already present.
 */
function formatGpa(gpa: unknown): string {
  const g = safeStr(gpa);
  if (!g) return "";
  // If data already says "GPA: 3.5" or "GPA: 9.41", don't add another "GPA:" prefix
  if (g.toLowerCase().startsWith("gpa")) return g;
  return `GPA: ${g}`;
}

/**
 * Safely coerce a skills array — handles string[], object[], or mixed.
 */
function normalizeSkills(skills: unknown[]): string[] {
  if (!skills || !Array.isArray(skills)) return [];
  return skills
    .map((s) => {
      if (typeof s === "string") return s.trim();
      if (typeof s === "object" && s !== null) {
        const obj = s as Record<string, unknown>;
        return safeStr(obj.name || obj.skill || obj.value || obj.label || "");
      }
      return "";
    })
    .filter((s) => s.length > 0 && s.toLowerCase() !== "null");
}

// ── Main Builder ─────────────────────────────────────────────

export function buildResumeHTML(data: ResumeData): string {
  const {
    professionalSummary,
    projects,
    experience,
    skills,
    education,
    profile,
    awards,
    certifications,
  } = data;

  const safeSummary = safeStr(professionalSummary);
  const normalizedSkills = normalizeSkills(skills);

  // ── Left Column ────────────────────────────────────────────

  // Professional Summary — rendered ONCE (in the section, NOT in the header)
  const summarySection = safeSummary
    ? `
    <div class="section">
      <h2>Professional Summary</h2>
      <p class="summary-text">${escapeHtml(safeSummary)}</p>
    </div>`
    : "";

  // Work Experience
  const validExperience = (experience || []).filter(
    (exp) => safeStr(exp.role) || safeStr(exp.company),
  );
  const experienceSection =
    validExperience.length > 0
      ? `
    <div class="section">
      <h2>Work Experience</h2>
      ${validExperience
        .map((exp) => {
          const company = safeStr(exp.company);
          const role = safeStr(exp.role);
          const dateRange = formatDateRange(exp.startDate, exp.endDate);
          return `
        <div class="entry">
          <div class="entry-header">
            <span class="entry-org">${escapeHtml(company || "Company")}</span>
            ${dateRange ? `<span class="entry-date">${escapeHtml(dateRange)}</span>` : ""}
          </div>
          ${role ? `<div class="entry-role">${escapeHtml(role)}</div>` : ""}
          ${buildBulletList(exp.bullets)}
        </div>`;
        })
        .join("")}
    </div>`
      : "";

  // Projects
  const validProjects = (projects || []).filter(
    (proj) => safeStr(proj.name) && (proj.bullets?.length > 0 || (proj.techStack && proj.techStack.length > 0)),
  );
  const projectsSection =
    validProjects.length > 0
      ? `
    <div class="section">
      <h2>Projects</h2>
      ${validProjects
        .map((proj) => {
          const techStack = (proj.techStack || []).map(safeStr).filter(Boolean);
          return `
        <div class="entry">
          <div class="entry-header">
            <span class="entry-org">${escapeHtml(safeStr(proj.name))}</span>
            ${techStack.length > 0 ? `<span class="entry-date">${techStack.map(escapeHtml).join(", ")}</span>` : ""}
          </div>
          ${buildBulletList(proj.bullets)}
        </div>`;
        })
        .join("")}
    </div>`
      : "";

  // ── Right Column (Sidebar) ─────────────────────────────────

  // Contact
  const contactLines: string[] = [];
  if (safeStr(profile.location)) contactLines.push(`📍 ${escapeHtml(safeStr(profile.location))}`);
  if (safeStr(profile.phone)) contactLines.push(`📞 ${escapeHtml(safeStr(profile.phone))}`);
  if (safeStr(profile.email)) contactLines.push(`✉️ ${escapeHtml(safeStr(profile.email))}`);
  if (safeStr(profile.linkedin)) contactLines.push(`🔗 ${escapeHtml(safeStr(profile.linkedin))}`);
  if (safeStr(profile.github)) contactLines.push(`💻 ${escapeHtml(safeStr(profile.github))}`);

  const contactSection =
    contactLines.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Contact</h3>
      ${contactLines.map((l) => `<p class="contact-line">${l}</p>`).join("")}
    </div>`
      : "";

  // Skills
  const skillsSection =
    normalizedSkills.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Skills</h3>
      <div class="skills-container">
        ${normalizedSkills.map((s) => `<span class="skill-pill">${escapeHtml(s)}</span>`).join("")}
      </div>
    </div>`
      : "";

  // Education
  const validEducation = (education || []).filter(
    (edu) => safeStr(edu.institution) || safeStr(edu.degree),
  );
  const educationSection =
    validEducation.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Education</h3>
      ${validEducation
        .map((edu) => {
          const institution = safeStr(edu.institution);
          const degree = safeStr(edu.degree);
          const field = safeStr(edu.field);
          const dateRange = formatDateRange(edu.startDate, edu.endDate);
          const gpa = formatGpa(edu.gpa);

          // Build degree line — avoid "null in null" patterns
          let degreeLine = degree;
          if (field && field !== degree) degreeLine += ` – ${field}`;

          return `
        <div class="edu-entry">
          ${institution ? `<p class="edu-institution">${escapeHtml(institution)}</p>` : ""}
          ${degreeLine ? `<p class="edu-degree">${escapeHtml(degreeLine)}</p>` : ""}
          ${dateRange ? `<p class="edu-date">${escapeHtml(dateRange)}</p>` : ""}
          ${gpa ? `<p class="edu-gpa">${escapeHtml(gpa)}</p>` : ""}
        </div>`;
        })
        .join("")}
    </div>`
      : "";

  // Awards
  const validAwards = (awards || []).filter((a) => safeStr(a.title));
  const awardsSection =
    validAwards.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Awards</h3>
      ${validAwards
        .map((a) => {
          const title = safeStr(a.title);
          const issuedAt = safeStr(a.issuedAt);
          return `<p class="award-item">${escapeHtml(title)}${issuedAt ? ` (${escapeHtml(issuedAt)})` : ""}</p>`;
        })
        .join("")}
    </div>`
      : "";

  // Certifications
  const validCerts = (certifications || []).filter((c) => safeStr(c.name));
  const certificationsSection =
    validCerts.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Certifications</h3>
      ${validCerts
        .map((c) => {
          const name = safeStr(c.name);
          const issuer = safeStr(c.issuer);
          return `<p class="cert-item">${escapeHtml(name)}${issuer ? ` — ${escapeHtml(issuer)}` : ""}</p>`;
        })
        .join("")}
    </div>`
      : "";

  // ── Full HTML ──────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(safeStr(profile.name) || "Resume")}</title>
  <style>
    /* ── Reset & Base ─────────────────────────────────── */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      color: #1a1a1a;
      background: #fff;
    }

    /* ── Page Layout ──────────────────────────────────── */
    .resume-page {
      width: 210mm;
      min-height: 297mm;
      display: flex;
      flex-direction: row;
    }

    .main-column {
      flex: 1;
      padding: 28px 24px 28px 32px;
    }

    .sidebar {
      width: 200px;
      background: #1e293b;
      color: #e2e8f0;
      padding: 28px 18px;
    }

    /* ── Header (Name) ────────────────────────────────── */
    .header-name {
      font-size: 22pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
    }

    /* ── Sections (Left) ──────────────────────────────── */
    .section {
      margin-bottom: 14px;
    }

    .section h2 {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      border-bottom: 2px solid #334155;
      padding-bottom: 3px;
      margin-bottom: 10px;
    }

    .summary-text {
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.5;
    }

    .entry {
      margin-bottom: 10px;
    }

    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 4px;
    }

    .entry-org {
      font-weight: 600;
      font-size: 10pt;
      color: #1e293b;
      flex: 1 1 auto;
      min-width: 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .entry-date {
      font-size: 8.5pt;
      color: #64748b;
      white-space: nowrap;
      flex-shrink: 0;
      text-align: right;
    }

    .entry-role {
      font-size: 9.5pt;
      font-style: italic;
      color: #475569;
      margin-bottom: 3px;
    }

    ul {
      padding-left: 16px;
      margin-top: 3px;
    }

    li {
      font-size: 9pt;
      color: #334155;
      margin-bottom: 2px;
      line-height: 1.4;
    }

    /* ── Sidebar Sections ─────────────────────────────── */
    .sidebar-section {
      margin-bottom: 18px;
    }

    .sidebar-section h3 {
      font-size: 9.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      border-bottom: 1px solid #475569;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }

    .contact-line {
      font-size: 8.5pt;
      color: #cbd5e1;
      margin-bottom: 4px;
      word-break: break-all;
    }

    /* ── Skills Pills ─────────────────────────────────── */
    .skills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .skill-pill {
      display: inline-block;
      font-size: 7.5pt;
      background: #334155;
      color: #e2e8f0;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }

    /* ── Education ─────────────────────────────────────── */
    .edu-entry {
      margin-bottom: 8px;
    }

    .edu-institution {
      font-size: 9pt;
      font-weight: 600;
      color: #e2e8f0;
    }

    .edu-degree {
      font-size: 8.5pt;
      color: #cbd5e1;
    }

    .edu-date {
      font-size: 8pt;
      color: #94a3b8;
    }

    .edu-gpa {
      font-size: 8pt;
      color: #94a3b8;
    }

    /* ── Awards & Certs ───────────────────────────────── */
    .award-item, .cert-item {
      font-size: 8.5pt;
      color: #cbd5e1;
      margin-bottom: 4px;
      line-height: 1.35;
    }

    /* ── Print Friendly ───────────────────────────────── */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .resume-page { min-height: auto; }
    }
  </style>
</head>
<body>
  <div class="resume-page">
    <!-- ── Main Column ──────────────────────────────── -->
    <div class="main-column">
      <h1 class="header-name">${escapeHtml(safeStr(profile.name) || "Your Name")}</h1>

      ${summarySection}
      ${experienceSection}
      ${projectsSection}
    </div>

    <!-- ── Sidebar ──────────────────────────────────── -->
    <div class="sidebar">
      ${contactSection}
      ${skillsSection}
      ${educationSection}
      ${awardsSection}
      ${certificationsSection}
    </div>
  </div>
</body>
</html>`;
}
