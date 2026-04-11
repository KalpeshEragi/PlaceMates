import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { generateResumePDF } from "../services/pdfService";
import { uploadRawToCloudinary } from "../services/cloudinaryService";

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
// Receives tailored resume data from n8n, generates a real PDF,
// uploads to Cloudinary, stores URL in DB, and returns it.
// ─────────────────────────────────────────────────────────────
export const generateResume = async (req: Request, res: Response) => {
  try {
    const { userId, jobId, resumeData, templateId } = req.body;

    if (!userId || !resumeData) {
      return res.status(400).json({ error: "userId and resumeData are required" });
    }

    console.log(`[generateResume] Generating PDF for user=${userId}, job=${jobId || "general"}`);

    // 1. Generate PDF buffer from tailored data
    const pdfBuffer = await generateResumePDF({
      professionalSummary: resumeData.professionalSummary || "",
      projects: resumeData.projects || [],
      experience: resumeData.experience || [],
      skills: resumeData.skills || [],
      education: resumeData.education || [],
      profile: resumeData.profile || { name: "", email: "" },
      awards: resumeData.awards || [],
      certifications: resumeData.certifications || [],
    });

    console.log(`[generateResume] PDF generated (${pdfBuffer.length} bytes)`);

    // 2. Upload PDF to Cloudinary
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

      // Check if job exists in DB
      let job = await prisma.job.findUnique({ where: { id: jobId } });

      if (!job) {
        // jobId might be a temp ID from n8n (tmp-*) — try to find by link if provided
        const jobLink = resumeData.jobLink || resumeData.job?.link;
        if (jobLink) {
          job = await prisma.job.findUnique({ where: { link: jobLink } });
          if (job) {
            realJobId = job.id;
            console.log(`[generateResume] Found job by link: ${realJobId}`);
          }
        }

        // If still no job found, try finding by title + company
        if (!job && (resumeData.jobTitle || resumeData.job?.title)) {
          const title = resumeData.jobTitle || resumeData.job?.title;
          const company = resumeData.jobCompany || resumeData.job?.company;
          job = await prisma.job.findFirst({
            where: {
              title: title,
              ...(company ? { company } : {}),
            },
            orderBy: { createdAt: "desc" },
          });
          if (job) {
            realJobId = job.id;
            console.log(`[generateResume] Found job by title/company: ${realJobId}`);
          }
        }

        // Last resort: create a temp job record so we can store the resume
        if (!job) {
          console.log(`[generateResume] Job ${jobId} not found, creating temp record`);
          job = await prisma.job.create({
            data: {
              title: resumeData.jobTitle || resumeData.job?.title || "Unknown Job",
              company: resumeData.jobCompany || resumeData.job?.company || "Unknown Company",
              location: resumeData.jobLocation || resumeData.job?.location || "Unknown",
              description: resumeData.jobDescription || resumeData.job?.description || "",
              link: `temp-${jobId}-${Date.now()}`,
              postedAt: new Date(),
            },
          });
          realJobId = job.id;
          console.log(`[generateResume] Created temp job: ${realJobId}`);
        }
      }

      // Upsert the TailoredResume with the REAL Cloudinary URL
      await prisma.tailoredResume.upsert({
        where: { userId_jobId: { userId, jobId: realJobId } },
        update: { resumeUrl },
        create: { userId, jobId: realJobId, resumeUrl },
      });
      console.log(`[generateResume] TailoredResume record saved for job=${realJobId} with URL=${resumeUrl}`);
    }

    // 4. Also update any existing TailoredResume records that have placeholder URLs
    try {
      const placeholderResumes = await prisma.tailoredResume.findMany({
        where: {
          userId,
          resumeUrl: { startsWith: "https://placeholder" },
        },
      });
      if (placeholderResumes.length > 0) {
        console.log(`[generateResume] Found ${placeholderResumes.length} resumes with placeholder URLs`);
      }
    } catch {
      // non-critical
    }

    return res.status(200).json({ success: true, resumeUrl });
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
    const { jobs } = req.body;
    if (!Array.isArray(jobs)) {
      return res.status(400).json({ error: "jobs array is required" });
    }

    const upsertedJobs = await Promise.all(
      jobs.map(async (job: any) => {
        // Validate / Parse date
        const postedAtStr = job.postedAt || new Date().toISOString();
        let postedAtDate = new Date(postedAtStr);
        if (isNaN(postedAtDate.getTime())) {
           postedAtDate = new Date();
        }

        if (!job.link) return null; // safety check
        
        return prisma.job.upsert({
          where: { link: job.link },
          create: {
            title: job.title || "Unknown Title",
            company: job.company || "Unknown Company",
            location: job.location || "Unknown Location",
            description: job.description || "",
            link: job.link,
            postedAt: postedAtDate,
            rawData: job.rawData || {},
          },
          update: {
            title: job.title || "Unknown Title",
            company: job.company || "Unknown Company",
            location: job.location || "Unknown Location",
            description: job.description || "",
            postedAt: postedAtDate,
            rawData: job.rawData || {},
          },
        });
      })
    );

    const validJobs = upsertedJobs.filter(Boolean);

    return res.status(200).json({ success: true, count: validJobs.length, jobs: validJobs });
  } catch (error) {
    console.error("[bulkUpsertJobs] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
