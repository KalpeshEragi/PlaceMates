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

function buildBulletList(bullets: string[]): string {
  if (!bullets || bullets.length === 0) return "";
  return `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
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

  // ── Left Column ────────────────────────────────────────────

  // Professional Summary
  const summarySection = professionalSummary
    ? `
    <div class="section">
      <h2>Professional Summary</h2>
      <p class="summary-text">${escapeHtml(professionalSummary)}</p>
    </div>`
    : "";

  // Work Experience
  const experienceSection =
    experience && experience.length > 0
      ? `
    <div class="section">
      <h2>Work Experience</h2>
      ${experience
        .map(
          (exp) => `
        <div class="entry">
          <div class="entry-header">
            <span class="entry-org">${escapeHtml(exp.company)}</span>
            <span class="entry-date">${escapeHtml(exp.startDate || "")} – ${escapeHtml(exp.endDate || "Present")}</span>
          </div>
          <div class="entry-role">${escapeHtml(exp.role)}</div>
          ${buildBulletList(exp.bullets)}
        </div>`
        )
        .join("")}
    </div>`
      : "";

  // Projects
  const projectsSection =
    projects && projects.length > 0
      ? `
    <div class="section">
      <h2>Projects</h2>
      ${projects
        .map(
          (proj) => `
        <div class="entry">
          <div class="entry-header">
            <span class="entry-org">${escapeHtml(proj.name)}</span>
            ${proj.techStack && proj.techStack.length > 0 ? `<span class="entry-date">${proj.techStack.map(escapeHtml).join(", ")}</span>` : ""}
          </div>
          ${buildBulletList(proj.bullets)}
        </div>`
        )
        .join("")}
    </div>`
      : "";

  // ── Right Column (Sidebar) ─────────────────────────────────

  // Contact
  const contactLines: string[] = [];
  if (profile.location) contactLines.push(`📍 ${escapeHtml(profile.location)}`);
  if (profile.phone) contactLines.push(`📞 ${escapeHtml(profile.phone)}`);
  if (profile.email) contactLines.push(`✉️ ${escapeHtml(profile.email)}`);
  if (profile.linkedin) contactLines.push(`🔗 ${escapeHtml(profile.linkedin)}`);
  if (profile.github) contactLines.push(`💻 ${escapeHtml(profile.github)}`);

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
    skills && skills.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Skills</h3>
      <div class="skills-container">
        ${skills.map((s) => `<span class="skill-pill">${escapeHtml(s)}</span>`).join("")}
      </div>
    </div>`
      : "";

  // Education
  const educationSection =
    education && education.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Education</h3>
      ${education
        .map(
          (edu) => `
        <div class="edu-entry">
          <p class="edu-institution">${escapeHtml(edu.institution)}</p>
          <p class="edu-degree">${escapeHtml(edu.degree)}${edu.field ? ` – ${escapeHtml(edu.field)}` : ""}</p>
          ${edu.startDate || edu.endDate ? `<p class="edu-date">${escapeHtml(edu.startDate || "")} – ${escapeHtml(edu.endDate || "Present")}</p>` : ""}
          ${edu.gpa ? `<p class="edu-gpa">GPA: ${escapeHtml(edu.gpa)}</p>` : ""}
        </div>`
        )
        .join("")}
    </div>`
      : "";

  // Awards
  const awardsSection =
    awards && awards.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Awards</h3>
      ${awards.map((a) => `<p class="award-item">${escapeHtml(a.title)}${a.issuedAt ? ` (${escapeHtml(a.issuedAt)})` : ""}</p>`).join("")}
    </div>`
      : "";

  // Certifications
  const certificationsSection =
    certifications && certifications.length > 0
      ? `
    <div class="sidebar-section">
      <h3>Certifications</h3>
      ${certifications.map((c) => `<p class="cert-item">${escapeHtml(c.name)}${c.issuer ? ` — ${escapeHtml(c.issuer)}` : ""}</p>`).join("")}
    </div>`
      : "";

  // ── Full HTML ──────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(profile.name || "Resume")}</title>
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
      margin-bottom: 2px;
      letter-spacing: -0.5px;
    }

    .header-title {
      font-size: 10pt;
      color: #475569;
      margin-bottom: 16px;
      font-weight: 400;
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
    }

    .entry-org {
      font-weight: 600;
      font-size: 10pt;
      color: #1e293b;
    }

    .entry-date {
      font-size: 8.5pt;
      color: #64748b;
      white-space: nowrap;
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
      <h1 class="header-name">${escapeHtml(profile.name || "Your Name")}</h1>
      <p class="header-title">${professionalSummary ? escapeHtml(professionalSummary.split(".")[0] + ".") : ""}</p>

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
