import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { generateResumePDF } from "../services/pdfService";
import { uploadRawToCloudinary } from "../services/cloudinaryService";
import * as semanticMatchingService from "../services/semantic/semanticMatchingService";

// ─────────────────────────────────────────────────────────────
// GET /api/internal/user-full-profile/:userId
// n8n fetches complete user data for job matching / resume gen
// ─────────────────────────────────────────────────────────────
export const getUserFullProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    const [user, skills, projects, experiences, educations, awards, certifications, summary, preferences] =
      await Promise.all([
        prisma.userAuth.findUnique({
          where: { id: userId },
          include: { profile: true, portfolio: true },
        }),
        prisma.skill.findMany({ where: { userId } }),
        prisma.project.findMany({
          where: { userId },
          orderBy: { rankingScore: "desc" },
        }),
        prisma.experience.findMany({ where: { userId } }),
        prisma.education.findMany({ where: { userId } }),
        prisma.award.findMany({ where: { userId } }),
        prisma.certification.findMany({ where: { userId } }),
        prisma.userSummary.findUnique({ where: { userId } }),
        prisma.jobPreferences.findUnique({ where: { userId } }),
      ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.profile?.name,
        primaryDomain: summary?.primaryDomain,
        resumeTemplateId: user.resumeTemplateId,
      },
      summary: summary?.summaryText || "",
      skills: skills.map((s) => ({
        name: s.name,
        domain: s.domain,
        source: s.source,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        techStack: p.techStack,
        domain: p.domain,
        finalBullets: p.finalBullets,
        baseBullets: p.baseBullets,
        description: p.description,
        repoUrl: p.repoUrl,
        rankingScore: p.rankingScore,
      })),
      experiences: experiences.map((e) => ({
        id: e.id,
        role: e.role,
        company: e.company,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description,
      })),
      educations: educations.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        startDate: e.startDate,
        endDate: e.endDate,
        gpa: e.gpa,
      })),
      awards: awards.map((a) => ({
        title: a.title,
        issuedAt: a.issuedAt,
      })),
      certifications: certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer,
      })),
      preferences,
    });
  } catch (error) {
    console.error("[getUserFullProfile] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/internal/generate-resume
// Two modes:
//   1. Legacy: n8n sends { resumeData } → direct PDF generation
//   2. RAG:    n8n sends { jobDescription } → RAG pipeline → PDF generation
// ─────────────────────────────────────────────────────────────
export const generateResume = async (req: Request, res: Response) => {
  try {
    const { userId, jobId, resumeData, jobDescription: rawJobDescription, jobTitle: rawJobTitle, jobCompany: rawJobCompany, templateId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Support "auto" mode: look up job details from DB using jobId
    let jobDescription = rawJobDescription;
    let jobTitle = rawJobTitle;
    let jobCompany = rawJobCompany;

    // Fast-exit: If node 5 returned [skipped: true], jobId is missing, so we must NOT generate a resume
    if (jobDescription === "auto" && !jobId) {
      console.log(`[generateResume] user=${userId} skipped (No jobId provided)`);
      return res.status(200).json({ success: true, skipped: true, message: "No jobId provided — skipping resume generation." });
    }

    if (jobDescription === "auto" && jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (job) {
        jobDescription = job.description;
        jobTitle = jobTitle || job.title;
        jobCompany = jobCompany || job.company;
        console.log(`[generateResume] Auto-resolved job: "${job.title}" at "${job.company}"`);
      } else {
        console.warn(`[generateResume] Job ${jobId} not found — falling back to legacy mode`);
        jobDescription = undefined;
      }
    }

    // Determine which mode to use
    const useRAG = !!jobDescription && jobDescription !== "auto" && !resumeData;

    console.log(`[generateResume] Mode=${useRAG ? "RAG" : "legacy"} user=${userId}, job=${jobId || "general"}`);

    let finalResumeData: any;
    let atsScore: number | null = null;
    let iterations = 1;
    let ragSources: string[] = [];
    let agentLog: any = null;

    if (useRAG) {
      // ── RAG Mode: Run retriever→drafter→critic ─────────

      // 1. Fetch user profile from NeonDB
      const userProfile = await prisma.userAuth.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          skills: true,
          projects: { orderBy: { rankingScore: "desc" }, take: 6 },
          experiences: true,
          educations: true,
          awards: true,
          certifications: true,
          summary: true,
          jobPreferences: true,
          portfolio: true,
        },
      });

      if (!userProfile) {
        return res.status(404).json({ error: "User profile not found" });
      }

      // 2. Build profile text for RAG context
      const { encodeProfileToText, buildProfileDataFromPrisma } = await import("../services/semantic/profileTextEncoder");
      const profileData = buildProfileDataFromPrisma(userProfile);
      const profileText = encodeProfileToText(profileData);

      // 3. Run RAG pipeline
      try {
        const ragResumeService = await import("../services/agents/ragResumeService");
        const ragResult = await ragResumeService.generate({
          userProfile: profileText,
          jobDescription,
          jobTitle: jobTitle || "Software Developer",
          jobCompany: jobCompany || "Company",
          domain: userProfile.summary?.primaryDomain || "Full Stack Developer",
          experienceLevel: userProfile.jobPreferences?.experienceLevel || "Entry",
          jobId: jobId || undefined,
          userId: userProfile.id,
        });

        if (ragResult) {
          atsScore = ragResult.atsScore;
          iterations = ragResult.iterations;
          ragSources = ragResult.ragSources;
          agentLog = ragResult.agentLog;

          // Convert RAG output to ResumeData format
          finalResumeData = {
            professionalSummary: ragResult.resumeData.professionalSummary,
            projects: ragResult.resumeData.projects.map((p) => ({
              name: p.name,
              techStack: p.techStack,
              bullets: p.bullets,
            })),
            experience: ragResult.resumeData.experience.map((e) => ({
              role: e.role,
              company: e.company,
              startDate: e.duration?.split(" - ")[0] || e.duration || "",
              endDate: e.duration?.split(" - ")[1] || null,
              bullets: e.bullets,
            })),
            skills: ragResult.resumeData.skills,
            education: ragResult.resumeData.education.map((e) => ({
              institution: e.institution,
              degree: e.degree,
              field: null,
              startDate: e.year,
              endDate: e.year,
              gpa: e.details || null,
            })),
            profile: {
              name: userProfile.profile?.name || "",
              email: userProfile.email,
              github: userProfile.portfolio?.githubUrl || undefined,
              linkedin: userProfile.portfolio?.linkedinUrl || undefined,
            },
            awards: ragResult.resumeData.awards?.map((a) => ({
              title: typeof a === "string" ? a : a,
            })) || [],
            certifications: ragResult.resumeData.certifications?.map((c) => ({
              name: c.name,
              issuer: c.issuer,
            })) || [],
          };

          console.log(`[generateResume] RAG pipeline succeeded: ATS=${atsScore}, iterations=${iterations}`);
        }
      } catch (ragErr: any) {
        console.error("[generateResume] RAG pipeline failed:", ragErr.message);
      }

      // Fallback: if RAG failed, generate a basic resume from profile data
      if (!finalResumeData) {
        console.log("[generateResume] RAG fallback — building resume from profile data");
        const userProfileData = await prisma.userAuth.findUnique({
          where: { id: userId },
          include: {
            profile: true,
            skills: true,
            projects: { orderBy: { rankingScore: "desc" }, take: 5 },
            experiences: true,
            educations: true,
            awards: true,
            certifications: true,
            summary: true,
            portfolio: true,
          },
        });

        finalResumeData = {
          professionalSummary: userProfileData?.summary?.summaryText || "",
          projects: (userProfileData?.projects || []).map((p) => ({
            name: p.name,
            techStack: p.techStack,
            bullets: p.finalBullets.length > 0 ? p.finalBullets : p.baseBullets,
          })),
          experience: (userProfileData?.experiences || []).map((e) => ({
            role: e.role,
            company: e.company,
            startDate: e.startDate || "",
            endDate: e.endDate || null,
            bullets: e.description ? [e.description] : [],
          })),
          skills: (userProfileData?.skills || []).map((s) => s.name),
          education: (userProfileData?.educations || []).map((e) => ({
            institution: e.institution,
            degree: e.degree || "",
            field: e.field,
            startDate: e.startDate || "",
            endDate: e.endDate || "",
            gpa: e.gpa,
          })),
          profile: {
            name: userProfileData?.profile?.name || "",
            email: userProfileData?.email || "",
            github: userProfileData?.portfolio?.githubUrl || undefined,
            linkedin: userProfileData?.portfolio?.linkedinUrl || undefined,
          },
          awards: (userProfileData?.awards || []).map((a) => ({ title: a.title })),
          certifications: (userProfileData?.certifications || []).map((c) => ({
            name: c.name,
            issuer: c.issuer || "",
          })),
        };
      }
    } else if (resumeData) {
      // ── Legacy Mode: Use pre-built resumeData from n8n ──
      finalResumeData = {
        professionalSummary: resumeData.professionalSummary || "",
        projects: resumeData.projects || [],
        experience: resumeData.experience || [],
        skills: resumeData.skills || [],
        education: resumeData.education || [],
        profile: resumeData.profile || { name: "", email: "" },
        awards: resumeData.awards || [],
        certifications: resumeData.certifications || [],
      };
    } else {
      return res.status(400).json({ error: "Either resumeData or jobDescription is required" });
    }

    // 1. Generate PDF buffer
    const pdfBuffer = await generateResumePDF(finalResumeData);
    console.log(`[generateResume] PDF generated (${pdfBuffer.length} bytes)`);

    // 2. Upload PDF to Cloudinary (using Image endpoint bypasses the Free Tier PDF raw restrictions)
    const publicId = `${userId}_${jobId || "general"}_${Date.now()}`;
    const resumeUrl = await uploadRawToCloudinary(
      pdfBuffer,
      "placemates/resumes",
      publicId,
    );
    console.log(`[generateResume] Uploaded to Cloudinary: ${resumeUrl}`);

    // 3. Store tailored resume record if jobId is provided
    if (jobId) {
      let realJobId = jobId;
      let job = await prisma.job.findUnique({ where: { id: jobId } });

      if (!job) {
        const jobLink = resumeData?.jobLink || resumeData?.job?.link;
        if (jobLink) {
          job = await prisma.job.findUnique({ where: { link: jobLink } });
          if (job) realJobId = job.id;
        }

        if (!job && (jobTitle || resumeData?.jobTitle)) {
          const title = jobTitle || resumeData?.jobTitle;
          const company = jobCompany || resumeData?.jobCompany;
          job = await prisma.job.findFirst({
            where: { title, ...(company ? { company } : {}) },
            orderBy: { createdAt: "desc" },
          });
          if (job) realJobId = job.id;
        }

        if (!job) {
          job = await prisma.job.create({
            data: {
              title: jobTitle || resumeData?.jobTitle || "Unknown Job",
              company: jobCompany || resumeData?.jobCompany || "Unknown Company",
              location: resumeData?.jobLocation || "Unknown",
              description: jobDescription || resumeData?.jobDescription || "",
              link: `temp-${jobId}-${Date.now()}`,
              postedAt: new Date(),
            },
          });
          realJobId = job.id;
        }
      }

      await prisma.tailoredResume.upsert({
        where: { userId_jobId: { userId, jobId: realJobId } },
        update: { resumeUrl, atsScore, iterations, ragSources, agentLog },
        create: { userId, jobId: realJobId, resumeUrl, atsScore, iterations, ragSources, agentLog },
      });
      console.log(`[generateResume] TailoredResume saved for job=${realJobId}`);
    }

    return res.status(200).json({
      success: true,
      resumeUrl,
      atsScore,
      iterations,
    });
  } catch (error) {
    console.error("[generateResume] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/internal/n8n-callback
// Safety-net callback from n8n to update WorkflowRun status
// ─────────────────────────────────────────────────────────────
export const n8nCallback = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    
    console.log("🔥 N8N RESULT:", body);
    
    if (body.status === "failed") {
      await prisma.workflowRun.updateMany({
        where: { requestId: body.requestId },
        data: {
          status: "failed",
          error: body.error?.message || "Internal error",
        },
      });
      return res.status(200).json({ ok: true });
    }

    // ✅ Save results
    await prisma.workflowRun.updateMany({
      where: { requestId: body.requestId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    // Save matched jobs
    if (Array.isArray(body.matchedJobs)) {
      await Promise.all(
        body.matchedJobs.map((job: any) =>
          prisma.jobMatch.upsert({
            where: {
              userId_jobId: {
                userId: body.userId,
                jobId: job.jobId,
              },
            },
            create: {
              userId: body.userId,
              jobId: job.jobId,
              matchScore: job.matchScore,
            },
            update: {
              matchScore: job.matchScore,
            },
          })
        )
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[n8nCallback] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/internal/trigger-placemate
// Initiates the placemate job matching n8n workflow
// ─────────────────────────────────────────────────────────────
export const triggerPlacemate = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const requestId = randomUUID();

    // Save initial workflow run
    await prisma.workflowRun.create({
      data: {
        requestId,
        userId,
        status: "pending",
      },
    });

    // 🔥 CALL N8N WEBHOOK
    fetch(env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env.INTERNAL_API_KEY || "",
      },
      body: JSON.stringify({
        requestId,
        userId,
        callbackUrl: `${env.BACKEND_URL}/api/internal/n8n-callback`,
        triggerType: "manual",
      }),
    }).catch((error) => {
      console.error(`[triggerPlacemate] n8n trigger error for requestId=${requestId}:`, error);
      // Optional: update status to failed gracefully if fetch fails
      prisma.workflowRun.update({
        where: { requestId },
        data: { status: "failed", error: "n8n trigger failed" },
      }).catch(e => console.error("Could not update workflow to failed", e));
    });

    return res.status(200).json({
      success: true,
      requestId,
    });
  } catch (error) {
    console.error("[triggerPlacemate] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/internal/jobs/bulk-upsert
// Inserts scraped jobs into the Job database table
// ─────────────────────────────────────────────────────────────
export const bulkUpsertJobs = async (req: Request, res: Response) => {
  try {
    // 1. Defensively parse jobs if it arrived as a string
    let parsedJobs = req.body.jobs;
    if (typeof parsedJobs === "string") {
      try {
        parsedJobs = JSON.parse(parsedJobs);
      } catch (parseError) {
        return res.status(400).json({ error: "Invalid JSON format for jobs" });
      }
    }

    if (!Array.isArray(parsedJobs)) {
      return res.status(400).json({ error: "req.body.jobs must be an array" });
    }

    // 2. Deduplicate jobs by link to prevent Prisma Unique Constraint errors (P2002) in a single batch
    const uniqueJobsMap = new Map();
    for (const job of parsedJobs) {
      if (job && typeof job.link === "string" && job.link.trim() !== "") {
        uniqueJobsMap.set(job.link, job);
      }
    }
    const uniqueJobs = Array.from(uniqueJobsMap.values());

    const upsertedJobs: any[] = [];
    const errors: any[] = [];

    // 3. Process sequentially (for...of) to prevent connection pool exhaustion and parallel upsert race conditions
    for (const job of uniqueJobs) {
      try {
        // 4. Strict Validation & Type Casting
        // Objects passing truthiness checks into Prisma String fields cause "Expected String, provided Object"
        const safeTitle = typeof job.title === "string" ? job.title : String(job.title || "Unknown Title");
        const safeCompany = typeof job.company === "string" ? job.company : String(job.company || "Unknown Company");
        const safeLocation = typeof job.location === "string" ? job.location : String(job.location || "Unknown Location");
        const safeDescription = typeof job.description === "string" ? job.description : String(job.description || "");

        let postedAtDate = new Date();
        if (typeof job.postedAt === "string" || typeof job.postedAt === "number") {
          const parsed = new Date(job.postedAt);
          if (!isNaN(parsed.getTime())) {
            postedAtDate = parsed;
          }
        }

        const upserted = await prisma.job.upsert({
          where: { link: job.link },
          create: {
            title: safeTitle,
            company: safeCompany,
            location: safeLocation,
            description: safeDescription,
            link: job.link,
            postedAt: postedAtDate,
            rawData: typeof job.rawData === "object" && job.rawData !== null ? job.rawData : {},
          },
          update: {
            title: safeTitle,
            company: safeCompany,
            location: safeLocation,
            description: safeDescription,
            postedAt: postedAtDate,
            rawData: typeof job.rawData === "object" && job.rawData !== null ? job.rawData : {},
          },
        });
        upsertedJobs.push(upserted);

      } catch (err: any) {
        console.error(`[bulkUpsertJobs] Failed to upsert job link ${job.link}:`, err.message);
        errors.push({ link: job.link, error: err.message });
      }
    }

    // NEW (Phase 4): Best-effort embed new jobs (non-blocking, fire-and-forget)
    if (upsertedJobs.length > 0) {
      const newJobIds = upsertedJobs.map((j) => j.id);
      semanticMatchingService.embedNewJobs(newJobIds).catch((err) => {
        console.warn("[bulkUpsertJobs] Background embedding failed (non-critical):", err.message);
      });
    }

    return res.status(200).json({ 
      success: true, 
      count: upsertedJobs.length, 
      errorsCount: errors.length,
      jobs: upsertedJobs.map(j => ({ id: j.id, link: j.link })),
      errors: errors.slice(0, 10), // Return sample of errors for debugging
    });
  } catch (error) {
    console.error("[bulkUpsertJobs] Fatal Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/internal/eligible-users
// Returns users who completed onboarding — n8n's daily scheduler uses this
// ─────────────────────────────────────────────────────────────
export const getEligibleUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.userAuth.findMany({
      where: { onboardingOutputFinalizedAt: { not: null } },
      select: {
        id: true,
        email: true,
        jobPreferences: true,
      },
    });
    return res.json({ success: true, users });
  } catch (error) {
    console.error("[getEligibleUsers] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/internal/semantic-match
// Called by n8n INSTEAD of its old AI scoring nodes
// ─────────────────────────────────────────────────────────────
export const semanticMatchForN8n = async (req: Request, res: Response) => {
  try {
    const { requestId, userId } = req.body;
    if (!userId || !requestId) {
      return res.status(400).json({ error: "userId and requestId required" });
    }

    // Update workflow status
    await prisma.workflowRun.updateMany({
      where: { requestId },
      data: { status: "processing" },
    });

    // Run semantic matching pipeline (now includes post-filtering by recency + preferences)
    const matches = await semanticMatchingService.matchJobsForUser(userId);

    if (matches?.length) {
      for (const m of matches) {
        await prisma.jobMatch.upsert({
          where: { userId_jobId: { userId, jobId: m.jobId } },
          create: {
            userId,
            jobId: m.jobId,
            matchScore: Math.round(m.score * 100),
            semanticScore: m.score,
            keywordScore: m.keywordScore,
            matchMethod: "semantic",
          },
          update: {
            matchScore: Math.round(m.score * 100),
            semanticScore: m.score,
            keywordScore: m.keywordScore,
            matchMethod: "semantic",
          },
        });
      }
      console.log(`[semanticMatchForN8n] Saved ${matches.length} filtered matches for user=${userId}`);
    } else {
      console.log(`[semanticMatchForN8n] No matches survived post-filtering for user=${userId}`);
    }

    // Always return HTTP 200 so n8n continues to the next node
    return res.status(200).json({
      success: true,
      matches: matches ?? [],
      method: matches ? "semantic" : "keyword",
      topK: matches?.length ?? 0,
      filtered: true,   // Signal to n8n that these are already post-filtered
    });
  } catch (err) {
    console.error("[semanticMatchForN8n] Error:", err);
    return res.status(200).json({ success: false, matches: [], method: "keyword", topK: 0, filtered: true });
  }
};
