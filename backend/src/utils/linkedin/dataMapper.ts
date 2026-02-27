// ────────────────────────────────────────────────────────────
// LinkedIn Import — Data Mapper
// ────────────────────────────────────────────────────────────
//
// Maps raw parsed rows from different LinkedIn CSV/XLSX files
// into the unified LinkedInProfile schema.
//
// Each category has its own mapper function. Unknown columns
// are silently ignored so partial exports still work.
// ────────────────────────────────────────────────────────────

import type {
    LinkedInProfile,
    LinkedInPersonal,
    LinkedInExperience,
    LinkedInEducation,
    LinkedInSkill,
    LinkedInProject,
    LinkedInCertification,
    LinkedInAward,
    LinkedInMedia,
    ParsedFile,
} from "./types.js";

// ── Helpers ────────────────────────────────────────────────

/**
 * Case-insensitive column lookup. LinkedIn export headers vary
 * between "First Name", "first name", "FirstName", etc.
 */
function col(row: Record<string, string>, ...candidates: string[]): string {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
        const found = keys.find(
            (k) => k.toLowerCase().replace(/[\s_-]/g, "") === candidate.toLowerCase().replace(/[\s_-]/g, "")
        );
        if (found && row[found]?.trim()) return row[found].trim();
    }
    return "";
}

/**
 * Format a date from LinkedIn columns. LinkedIn uses separate
 * "Started On" / "Finished On" or "Start Date" / "End Date"
 * columns, sometimes with "Mon YYYY" format.
 */
function dateStr(row: Record<string, string>, ...candidates: string[]): string | undefined {
    const val = col(row, ...candidates);
    return val || undefined;
}

// ── Mapper functions per category ──────────────────────────

function mapPersonal(rows: Record<string, string>[]): LinkedInPersonal {
    // Profile.csv usually has a single row
    const row = rows[0] ?? {};
    return {
        firstName: col(row, "FirstName", "First Name"),
        lastName: col(row, "LastName", "Last Name"),
        headline: col(row, "Headline"),
        location: col(row, "Location", "Geo Location", "GeoLocation"),
        industry: col(row, "Industry"),
        profileUrl: col(row, "PublicProfileUrl", "Profile Url", "Public Profile Url", "URL"),
    };
}

function mapAbout(rows: Record<string, string>[]): string {
    // Summary.csv typically has a "Summary" column
    const row = rows[0] ?? {};
    return col(row, "Summary", "About", "Description") || "";
}

function mapExperience(rows: Record<string, string>[]): LinkedInExperience[] {
    return rows.map((row) => ({
        companyName: col(row, "CompanyName", "Company Name", "Organization Name", "Organization"),
        title: col(row, "Title", "Position", "Role"),
        location: col(row, "Location") || undefined,
        startDate: dateStr(row, "StartedOn", "Started On", "Start Date"),
        endDate: dateStr(row, "FinishedOn", "Finished On", "End Date"),
        description: col(row, "Description", "Summary") || undefined,
    })).filter((e) => e.companyName || e.title); // skip empty rows
}

function mapEducation(rows: Record<string, string>[]): LinkedInEducation[] {
    return rows.map((row) => ({
        schoolName: col(row, "SchoolName", "School Name", "Institution"),
        degree: col(row, "DegreeName", "Degree Name", "Degree") || undefined,
        fieldOfStudy: col(row, "FieldOfStudy", "Field Of Study", "Field of Study") || undefined,
        startDate: dateStr(row, "StartDate", "Start Date", "Started On"),
        endDate: dateStr(row, "EndDate", "End Date", "Finished On"),
        activities: col(row, "Activities", "Activities and Societies") || undefined,
        notes: col(row, "Notes") || undefined,
    })).filter((e) => e.schoolName);
}

function mapSkills(rows: Record<string, string>[]): LinkedInSkill[] {
    return rows.map((row) => ({
        name: col(row, "Name", "Skill", "SkillName", "Skill Name"),
    })).filter((s) => s.name);
}

function mapProjects(rows: Record<string, string>[]): LinkedInProject[] {
    return rows.map((row) => ({
        title: col(row, "Title", "Name", "ProjectName", "Project Name"),
        description: col(row, "Description") || undefined,
        url: col(row, "Url", "URL", "Link") || undefined,
        startDate: dateStr(row, "StartedOn", "Started On", "Start Date"),
        endDate: dateStr(row, "FinishedOn", "Finished On", "End Date"),
    })).filter((p) => p.title);
}

function mapCertifications(rows: Record<string, string>[]): LinkedInCertification[] {
    return rows.map((row) => ({
        name: col(row, "Name", "CertificationName", "Certification Name"),
        authority: col(row, "Authority", "Organization", "Issuing Organization") || undefined,
        licenseNumber: col(row, "LicenseNumber", "License Number", "Credential ID") || undefined,
        url: col(row, "Url", "URL", "Credential URL") || undefined,
        startDate: dateStr(row, "StartedOn", "Started On", "Start Date"),
        endDate: dateStr(row, "FinishedOn", "Finished On", "End Date"),
    })).filter((c) => c.name);
}

function mapAwards(rows: Record<string, string>[]): LinkedInAward[] {
    return rows.map((row) => ({
        title: col(row, "Title", "Name", "Honor Name"),
        issuer: col(row, "Issuer", "Organization", "Issued By") || undefined,
        issueDate: dateStr(row, "IssueDate", "Issue Date", "Date", "Issued On"),
        description: col(row, "Description") || undefined,
    })).filter((a) => a.title);
}

function mapEmails(rows: Record<string, string>[]): string[] {
    return rows
        .map((row) => col(row, "EmailAddress", "Email Address", "Email", "Address"))
        .filter(Boolean);
}

function mapPhones(rows: Record<string, string>[]): string[] {
    return rows
        .map((row) => col(row, "Number", "PhoneNumber", "Phone Number", "Phone"))
        .filter(Boolean);
}

function mapMedia(rows: Record<string, string>[]): LinkedInMedia[] {
    return rows.map((row) => ({
        title: col(row, "Title", "Name") || undefined,
        description: col(row, "Description") || undefined,
        url: col(row, "Url", "URL", "Link") || undefined,
        type: col(row, "Type", "MediaType", "Media Type") || undefined,
    })).filter((m) => m.url || m.title);
}

// ── Main mapper ────────────────────────────────────────────

/**
 * Takes an array of ParsedFile objects (each with a category
 * and its row data) and produces a single LinkedInProfile.
 *
 * Multiple files that map to the same category are merged
 * (arrays are concatenated, objects are shallow-merged).
 */
export function mapToLinkedInProfile(files: ParsedFile[]): LinkedInProfile {
    // Start with an empty profile
    const profile: LinkedInProfile = {
        personal: {},
        about: "",
        contact: { emails: [], phones: [] },
        experience: [],
        education: [],
        skills: [],
        projects: [],
        certifications: [],
        awards: [],
        media: [],
    };

    for (const { category, rows } of files) {
        if (rows.length === 0) continue;

        switch (category) {
            case "personal":
                profile.personal = { ...profile.personal, ...mapPersonal(rows) };
                break;
            case "about":
                profile.about = mapAbout(rows) || profile.about;
                break;
            case "experience":
                profile.experience.push(...mapExperience(rows));
                break;
            case "education":
                profile.education.push(...mapEducation(rows));
                break;
            case "skills":
                profile.skills.push(...mapSkills(rows));
                break;
            case "projects":
                profile.projects.push(...mapProjects(rows));
                break;
            case "certifications":
                profile.certifications.push(...mapCertifications(rows));
                break;
            case "awards":
                profile.awards.push(...mapAwards(rows));
                break;
            case "emails":
                profile.contact.emails.push(...mapEmails(rows));
                break;
            case "phones":
                profile.contact.phones.push(...mapPhones(rows));
                break;
            case "media":
                profile.media.push(...mapMedia(rows));
                break;
        }
    }

    // Deduplicate skills by name
    const seen = new Set<string>();
    profile.skills = profile.skills.filter((s) => {
        const key = s.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Deduplicate emails
    profile.contact.emails = [...new Set(profile.contact.emails)];

    return profile;
}
