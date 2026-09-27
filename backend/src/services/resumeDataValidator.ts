/**
 * resumeDataValidator.ts
 *
 * Validates and sanitizes all resume data BEFORE it reaches the HTML template.
 * Ensures:
 *   - No "null", "undefined", "N/A", "[object Object]" strings leak into output
 *   - Dates are valid date strings (not "null – null" or "2018 – 2018")
 *   - Every required section has real content
 *   - Skills are strings, not objects
 *   - Bullets are non-empty strings
 *   - GPA doesn't have duplicate "GPA:" prefix
 */

import type { ResumeData, ResumeExperience, ResumeProject, ResumeEducation } from "./resumeTemplate";

// ── Poison words that should never appear in a resume ────────
const POISON_WORDS = [
  "null", "undefined", "n/a", "na", "none", "object object",
  "[object object]", "nan", "not available", "not specified",
  "unknown", "tbd", "todo", "placeholder",
];

const POISON_REGEX = new RegExp(
  `^\\s*(${POISON_WORDS.join("|")})\\s*$`, "i"
);

// ── Core Sanitization Helpers ────────────────────────────────

/**
 * Returns a clean string or empty string if the value is poisoned.
 */
function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean).join(", ");
    const obj = value as Record<string, unknown>;
    return clean(obj.name || obj.title || obj.text || obj.value || obj.label || "");
  }

  const s = String(value).trim();
  if (POISON_REGEX.test(s)) return "";
  // Also catch patterns like "null - null", "null – Present"
  if (/^null\b/i.test(s)) return "";
  return s;
}

/**
 * Returns a clean, non-empty array of strings.
 */
function cleanArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === "string") return clean(item);
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        return clean(obj.name || obj.skill || obj.value || obj.label || obj.title || "");
      }
      return "";
    })
    .filter((s) => s.length > 0);
}

/**
 * Validates and fixes a date string.
 * Returns empty string for invalid/poison values.
 */
function cleanDate(value: unknown): string {
  const s = clean(value);
  if (!s) return "";

  // Reject if it's just a number and not a reasonable year
  if (/^\d+$/.test(s)) {
    const year = parseInt(s, 10);
    if (year < 1950 || year > 2100) return "";
    return s;
  }

  // Accept common date formats: "Jan 2024", "2024", "January 2024", "01/2024", "Present"
  if (/present|current|now|ongoing/i.test(s)) return "Present";

  // Reject if it looks like garbage
  if (s.length > 50) return "";

  return s;
}

/**
 * Formats a date range safely, avoiding "null – null" or "2018 – 2018".
 */
function makeDateRange(start: unknown, end: unknown): string {
  const s = cleanDate(start);
  const e = cleanDate(end);

  if (!s && !e) return "";
  if (!s && e) return e;
  if (s && !e) return `${s} – Present`;
  if (s === e) return s;
  return `${s} – ${e}`;
}

/**
 * Fixes GPA strings to avoid "GPA: GPA: 3.5/4.0".
 */
function cleanGpa(value: unknown): string {
  const s = clean(value);
  if (!s) return "";
  // Remove redundant "GPA:" prefix if present
  const stripped = s.replace(/^gpa\s*[:：]\s*/i, "").trim();
  if (!stripped) return "";
  return stripped;
}

// ── Section Validators ───────────────────────────────────────

function validateExperience(exp: ResumeExperience): ResumeExperience | null {
  const company = clean(exp.company);
  const role = clean(exp.role);

  // Must have at least a role or company
  if (!company && !role) return null;

  const bullets = cleanArray(exp.bullets).filter((b) => b.length > 5);

  return {
    role: role || "Role",
    company: company || "Company",
    startDate: cleanDate(exp.startDate),
    endDate: cleanDate(exp.endDate),
    bullets,
  };
}

function validateProject(proj: ResumeProject): ResumeProject | null {
  const name = clean(proj.name);
  if (!name) return null;

  const bullets = cleanArray(proj.bullets).filter((b) => b.length > 5);
  const techStack = cleanArray(proj.techStack);

  // Project must have at least name + 1 bullet or techStack
  if (bullets.length === 0 && techStack.length === 0) return null;

  return {
    name,
    techStack,
    bullets,
  };
}

function validateEducation(edu: ResumeEducation): ResumeEducation | null {
  const institution = clean(edu.institution);
  const degree = clean(edu.degree);

  // Must have at least institution or degree
  if (!institution && !degree) return null;

  const field = clean(edu.field);
  const gpa = cleanGpa(edu.gpa);

  return {
    institution: institution || "University",
    degree: degree || "Degree",
    field: field || null,
    startDate: cleanDate(edu.startDate),
    endDate: cleanDate(edu.endDate),
    gpa: gpa || null,
  };
}

// ── Main Validator ───────────────────────────────────────────

/**
 * Validates and sanitizes the full ResumeData object.
 * This should be called RIGHT BEFORE passing data to buildResumeHTML().
 *
 * @returns Sanitized ResumeData — guaranteed to have no poison values
 */
export function validateResumeData(data: ResumeData): ResumeData {
  const summary = clean(data.professionalSummary);
  const skills = cleanArray(data.skills);

  // Validate each section
  const experience = (data.experience || [])
    .map(validateExperience)
    .filter((e): e is ResumeExperience => e !== null);

  const projects = (data.projects || [])
    .map(validateProject)
    .filter((p): p is ResumeProject => p !== null);

  const education = (data.education || [])
    .map(validateEducation)
    .filter((e): e is ResumeEducation => e !== null);

  const awards = (data.awards || [])
    .map((a) => {
      const title = clean(typeof a === "string" ? a : a?.title);
      if (!title) return null;
      const issuedAt = clean(a?.issuedAt);
      return { title, issuedAt: issuedAt || undefined };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const certifications = (data.certifications || [])
    .map((c) => {
      const name = clean(typeof c === "string" ? c : c?.name);
      if (!name) return null;
      // Filter out placeholder certs like "Cert Name"
      if (/^cert\s*name$/i.test(name)) return null;
      const issuer = clean(c?.issuer);
      // Filter out placeholder issuers
      if (issuer && /^issuer$/i.test(issuer)) {
        return { name, issuer: undefined };
      }
      return { name, issuer: issuer || undefined };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Sanitize profile
  const profile = {
    name: clean(data.profile?.name) || "Your Name",
    email: clean(data.profile?.email) || "",
    phone: clean(data.profile?.phone) || undefined,
    github: clean(data.profile?.github) || undefined,
    linkedin: clean(data.profile?.linkedin) || undefined,
    location: clean(data.profile?.location) || undefined,
  };

  const validated: ResumeData = {
    professionalSummary: summary,
    skills,
    experience,
    projects,
    education,
    profile,
    awards,
    certifications,
  };

  // Log validation summary
  const removed = {
    experience: (data.experience?.length || 0) - experience.length,
    projects: (data.projects?.length || 0) - projects.length,
    education: (data.education?.length || 0) - education.length,
    skills: (data.skills?.length || 0) - skills.length,
    awards: (data.awards?.length || 0) - awards.length,
    certs: (data.certifications?.length || 0) - certifications.length,
  };

  const totalRemoved = Object.values(removed).reduce((a, b) => a + b, 0);
  if (totalRemoved > 0) {
    console.log(
      `[ResumeValidator] Sanitized data — removed ${totalRemoved} invalid entries:`,
      JSON.stringify(removed),
    );
  }

  return validated;
}
