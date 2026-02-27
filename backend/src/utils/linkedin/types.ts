// ────────────────────────────────────────────────────────────
// LinkedIn Import — Unified profile types
// ────────────────────────────────────────────────────────────

export interface LinkedInPersonal {
    firstName?: string;
    lastName?: string;
    headline?: string;
    location?: string;
    industry?: string;
    profileUrl?: string;
    [key: string]: unknown;
}

export interface LinkedInExperience {
    companyName: string;
    title: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
}

export interface LinkedInEducation {
    schoolName: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    activities?: string;
    notes?: string;
}

export interface LinkedInSkill {
    name: string;
}

export interface LinkedInProject {
    title: string;
    description?: string;
    url?: string;
    startDate?: string;
    endDate?: string;
}

export interface LinkedInCertification {
    name: string;
    authority?: string;
    licenseNumber?: string;
    url?: string;
    startDate?: string;
    endDate?: string;
}

export interface LinkedInAward {
    title: string;
    issuer?: string;
    issueDate?: string;
    description?: string;
}

export interface LinkedInMedia {
    title?: string;
    description?: string;
    url?: string;
    type?: string;
}

/**
 * The unified LinkedIn profile schema.
 * All fields are optional — partial imports are valid.
 */
export interface LinkedInProfile {
    personal: LinkedInPersonal;
    about: string;
    contact: {
        emails: string[];
        phones: string[];
    };
    experience: LinkedInExperience[];
    education: LinkedInEducation[];
    skills: LinkedInSkill[];
    projects: LinkedInProject[];
    certifications: LinkedInCertification[];
    awards: LinkedInAward[];
    media: LinkedInMedia[];
}

/**
 * Represents a single parsed file: its category + row data.
 */
export interface ParsedFile {
    category: string;
    rows: Record<string, string>[];
}

/**
 * Categories that map filenames → schema sections.
 */
export type LinkedInCategory =
    | "personal"
    | "about"
    | "experience"
    | "education"
    | "skills"
    | "projects"
    | "certifications"
    | "awards"
    | "emails"
    | "phones"
    | "media";
