export type JobPreferences = {
  userId?: string;
  primaryRole: string;
  secondaryRoles: string[];
  workType: string;
  locations: string[];
  minSalary: number;
  currency: string;
  experienceLevel: string;
  jobType: string;
};

export const ROLES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack",
  "AI/ML",
  "DevOps",
  "Mobile Developer",
  "Data Scientist",
];

export const WORK_TYPES = ["Remote", "Onsite", "Hybrid"];

export const EXPERIENCE_LEVELS = ["Fresher", "0–2 years", "2–5 years", "5+ years"];

export const JOB_TYPES = ["Internship", "Full-time", "Contract"];

export const CURRENCIES = ["INR", "USD"];
