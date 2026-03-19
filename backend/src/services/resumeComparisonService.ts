import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

if (!env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not configured");
}

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

function getModel() {
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// Interfaces
export interface JobRequirements {
  role?: string;
  skills: string[];
  experienceLevel?: string;
  description?: string;
}

export interface UserData {
  skills: string[];
  projects: Array<{ name: string; description: string; techStack?: string[] }>;
  experience: Array<{ role: string; company: string; description: string }>;
}

export interface RelevanceScore {
  skillsMatch: Array<{ skill: string; score: number }>;
  projectMatch: Array<{ project: string; score: number }>;
  experienceMatch: Array<{ role: string; score: number }>;
  overallScore: number;
  analysisReasoning: string;
  missingSkills: string[];
}

// Fallback in case of complete failure
const FALLBACK_RESULT: RelevanceScore = {
  skillsMatch: [],
  projectMatch: [],
  experienceMatch: [],
  overallScore: 0,
  analysisReasoning: "Failed to analyze resume match due to an internal error.",
  missingSkills: [],
};

// Types for Final ATS Evaluation
export interface AtsEvaluationResult {
  atsScore: number;
  keywordMatch: Array<{ keyword: string; matched: boolean }>;
  missingSkills: string[];
  suggestions: string[];
}

const FALLBACK_ATS_RESULT: AtsEvaluationResult = {
  atsScore: 0,
  keywordMatch: [],
  missingSkills: [],
  suggestions: ["Failed to generate ATS evaluation due to an internal error."],
};

// Helpers for input processing
function sanitizeAndTruncate(text: string, maxLength: number): string {
  if (!text) return "";
  // Basic sanitization: remove extreme whitespaces
  const sanitized = text.replace(/\s+/g, " ").trim();
  return sanitized.slice(0, maxLength);
}

function formatUserData(userData: UserData): string {
  const skillsStr = userData.skills.join(", ");
  
  const projectsStr = userData.projects
    .map((p) => `- ${p.name}: ${p.description} (Tech: ${p.techStack?.join(", ") || "N/A"})`)
    .join("\n");
    
  const expStr = userData.experience
    .map((e) => `- ${e.role} at ${e.company}: ${e.description}`)
    .join("\n");

  return `
USER SKILLS:
${skillsStr || "None provided"}

USER PROJECTS:
${projectsStr || "None provided"}

USER EXPERIENCE:
${expStr || "None provided"}
`.trim();
}

function formatJobRequirements(jobReq: JobRequirements): string {
  return `
ROLE: ${jobReq.role || "Not specified"}
EXPERIENCE LEVEL: ${jobReq.experienceLevel || "Not specified"}
REQUIRED SKILLS: ${jobReq.skills.join(", ") || "Not specified"}
DESCRIPTION:
${jobReq.description ? sanitizeAndTruncate(jobReq.description, 5000) : "Not specified"}
`.trim();
}

// Exponential backoff retry wrapper
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number = 2,
  delay: number = 1000
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries === 0) throw error;
    console.warn(`[resumeComparisonService] Operation failed, retrying in ${delay}ms...`, error);
    await new Promise((res) => setTimeout(res, delay));
    return withRetry(operation, retries - 1, delay * 2);
  }
}

/**
 * Compares Job Requirements against User Data using Gemini LLM.
 * Returns structured relevance scores.
 */
export async function compareResumeWithJob(
  jobRequirements: JobRequirements,
  userData: UserData
): Promise<RelevanceScore> {
  try {
    const formattedJobParams = formatJobRequirements(jobRequirements);
    // Securely truncate the combined user data to avoid token limits / prompt injection overloads
    const formattedUserParams = sanitizeAndTruncate(formatUserData(userData), 8000);

    const prompt = `
You are a precise and expert technical recruiter and resume evaluator.
Your task is to compare a candidate's resume data against specific job requirements and provide objective relevance scores.

### INSTRUCTIONS:
1. Assess how well the candidate's skills match the job's required skills. Score from 0.0 to 1.0.
   - 1.0: Perfect match (e.g., candidate has "React" and job requires "React").
   - 0.5: Partial/Semantic match (e.g., candidate has "Java" and job requires "C#", or specific tool vs general concept).
   - 0.0: No match.
2. Assess how well the candidate's projects demonstrate the required skills or experience for the role. Score 0.0 to 1.0 per project.
3. Assess how well the candidate's past experience aligns with the required role and experience level. Score 0.0 to 1.0 per role.
4. Calculate an realistic \`overallScore\` (0.0 to 1.0) representing the candidate's holistic fit for the job.
5. Provide a single-sentence \`analysisReasoning\` explaining the overall score.
6. Identify any crucial \`missingSkills\` that the job requires but the candidate entirely lacks.

### OUTPUT FORMAT:
You MUST return ONLY valid JSON matching this exact typescript interface. Do not include markdown code block backticks \`\`\`json. Return raw JSON.

type RelevanceScore = {
  skillsMatch: { skill: string; score: number }[];
  projectMatch: { project: string; score: number }[];
  experienceMatch: { role: string; score: number }[];
  overallScore: number;
  analysisReasoning: string;
  missingSkills: string[];
}

If arrays have no matches, return empty arrays \`[]\`.

### JOB REQUIREMENTS:
${formattedJobParams}

### CANDIDATE DATA:
${formattedUserParams}
`;

    const model = getModel();

    // Wrapping LLM call in a retry mechanism
    const result = await withRetry(async () => {
      return await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1, // Low temperature for deterministic/objective scoring
          responseMimeType: "application/json",
        },
      });
    }, 2, 1000);

    const rawText = result.response.text();

    try {
      const parsed = JSON.parse(rawText);
      return {
        skillsMatch: Array.isArray(parsed.skillsMatch) ? parsed.skillsMatch : [],
        projectMatch: Array.isArray(parsed.projectMatch) ? parsed.projectMatch : [],
        experienceMatch: Array.isArray(parsed.experienceMatch) ? parsed.experienceMatch : [],
        overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 0,
        analysisReasoning: parsed.analysisReasoning || "Analysis complete.",
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      };
    } catch (parseErr) {
      console.error("[resumeComparisonService] Failed to parse JSON from Gemini:", parseErr);
      console.error("Raw response output:", rawText);
      return FALLBACK_RESULT;
    }

  } catch (error) {
    console.error("[resumeComparisonService] Critical error during comparison:", error);
    return FALLBACK_RESULT;
  }
}

/**
 * Evaluates the final generated resume content against Job Requirements.
 * Returns an ATS Score, keyword matches, and AI suggestions.
 */
export async function evaluateResumeAts(
  jobRequirements: JobRequirements,
  resumeData: any
): Promise<AtsEvaluationResult> {
  try {
    const formattedJobParams = formatJobRequirements(jobRequirements);
    // Serialize the final resume data (typically JSON from the frontend builder)
    const formattedResumeParams = sanitizeAndTruncate(JSON.stringify(resumeData), 8000);

    const prompt = `
You are a precise ATS (Applicant Tracking System) simulator and expert career coach.
Your task is to evaluate a candidate's final drafted resume against specific job requirements.

### INSTRUCTIONS:
1. Calculate an \`atsScore\` from 0 to 100 based on how well the resume matches the job requirements (keywords, skills, experience, projects).
2. Look for important keywords/skills from the Job Requirements inside the resume. Return a list of \`keywordMatch\` objects, with the keyword and a boolean \`matched\` (true if found in the resume, false otherwise).
3. Identify \`missingSkills\` from the job requirements that are completely absent from the resume.
4. Provide 2-4 actionable \`suggestions\` on how the candidate can improve their resume specifically for this job (e.g., "Add measurable metrics to the XYZ project", "Include more backend architecture keywords"). Keep suggestions helpful but concise. DO NOT automatically modify the resume.

### OUTPUT FORMAT:
You MUST return ONLY valid JSON matching this exact typescript interface. Do not include markdown code block backticks \`\`\`json. Return raw JSON.

type AtsEvaluationResult = {
  atsScore: number; // 0 to 100
  keywordMatch: { keyword: string; matched: boolean }[];
  missingSkills: string[];
  suggestions: string[];
}

If no data is present, return empty arrays \`[]\` and a score of 0.

### JOB REQUIREMENTS:
${formattedJobParams}

### DRAFTED RESUME CONTENT:
${formattedResumeParams}
`;

    const model = getModel();

    const result = await withRetry(async () => {
      return await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });
    }, 2, 1000);

    const rawText = result.response.text();

    try {
      const parsed = JSON.parse(rawText);
      return {
        atsScore: typeof parsed.atsScore === "number" ? parsed.atsScore : 0,
        keywordMatch: Array.isArray(parsed.keywordMatch) ? parsed.keywordMatch : [],
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (parseErr) {
      console.error("[resumeComparisonService] Failed to parse ATS evaluation JSON:", parseErr);
      console.error("Raw response output:", rawText);
      return FALLBACK_ATS_RESULT;
    }

  } catch (error) {
    console.error("[resumeComparisonService] Critical error during ATS evaluation:", error);
    return FALLBACK_ATS_RESULT;
  }
}

