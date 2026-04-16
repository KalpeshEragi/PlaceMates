import { Request, Response } from "express";
import { randomUUID } from "crypto";
import axios from "axios";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import type { AuthRequest } from "../middleware/auth";

// ─────────────────────────────────────────────────────────────
// POST /api/workflow/trigger
// Called by frontend when user clicks "Start Job Matching"
// ─────────────────────────────────────────────────────────────
export const triggerWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // 1. Verify user exists and has job preferences
    const user = await prisma.userAuth.findUnique({
      where: { id: userId },
      include: {
        jobPreferences: true,
        profile: true,
        skills: true,
        experiences: true,
        educations: true,
        awards: true,
        certifications: true,
        projects: {
          orderBy: { rankingScore: "desc" },
          take: 6,
        },
        summary: true,
        portfolio: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.jobPreferences) {
      return res.status(400).json({
        success: false,
        message: "Please set your job preferences before starting job matching",
      });
    }

    // 2. Check if there's already a pending/processing run
    const activeRun = await prisma.workflowRun.findFirst({
      where: { userId, status: { in: ["pending", "processing"] } },
    });

    if (activeRun) {
      return res.status(409).json({
        success: false,
        message: "A workflow is already in progress",
        requestId: activeRun.requestId,
      });
    }

    // 3. Create WorkflowRun record
    const requestId = randomUUID();
    await prisma.workflowRun.create({
      data: {
        userId,
        requestId,
        triggerType: "manual",
        status: "pending",
      },
    });

    // 4. Build payload for n8n
    const n8nPayload = buildN8nPayload(requestId, user);

    // 5. Trigger n8n webhook (fire-and-forget — don't block the response)
    axios
      .post(env.N8N_WEBHOOK_URL, n8nPayload, {
        headers: {
          "Content-Type": "application/json",
          "x-n8n-secret": env.N8N_WEBHOOK_SECRET,
        },
        timeout: 10000,
      })
      .then(() => {
        console.log(`[Workflow] n8n triggered for requestId=${requestId}`);
      })
      .catch(async (err) => {
        console.error(
          `[Workflow] n8n trigger failed for requestId=${requestId}:`,
          err.message
        );
        await prisma.workflowRun.update({
          where: { requestId },
          data: {
            status: "failed",
            error: `n8n trigger failed: ${err.message}`,
          },
        });
      });

    // 6. Return immediately with requestId
    return res.status(202).json({
      success: true,
      requestId,
      status: "pending",
      message: "Workflow triggered. Poll status for results.",
    });
  } catch (error) {
    console.error("[triggerWorkflow] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/workflow/n8n-result   (callback FROM n8n)
// ─────────────────────────────────────────────────────────────
export const receiveResults = async (req: Request, res: Response) => {
  try {
    const {
      requestId,
      userId,
      matchedJobs,
      insights,
    } = req.body;

    if (!requestId || !userId) {
      return res
        .status(400)
        .json({ error: "requestId and userId are required" });
    }

    // 1. Verify the workflow run exists
    const run = await prisma.workflowRun.findUnique({
      where: { requestId },
    });

    if (!run) {
      return res.status(404).json({ error: "WorkflowRun not found" });
    }

    if (run.status === "completed") {
      return res.status(200).json({ message: "Already processed" });
    }

    console.log(`[receiveResults] Processing callback for requestId=${requestId}, ${matchedJobs?.length ?? 0} jobs`);

    // 2. Store results in a transaction
    await prisma.$transaction(
      async (tx) => {
        // 2a. Create/update JobMatch records
        // Jobs are already in the DB from the bulk-upsert step.
        // The n8n aggregate sends { jobId, matchScore, resumeUrl, ... }
        if (Array.isArray(matchedJobs)) {
          for (const job of matchedJobs) {
            // jobId is already the DB UUID from the earlier pipeline steps
            if (!job.jobId) continue;

            // Verify the job exists in our DB
            const existingJob = await tx.job.findUnique({
              where: { id: job.jobId },
            });
            if (!existingJob) {
              console.warn(`[receiveResults] Job ${job.jobId} not found in DB, skipping`);
              continue;
            }

            // Upsert the JobMatch (one per user-job pair)
            await tx.jobMatch.upsert({
              where: {
                userId_jobId: { userId, jobId: job.jobId },
              },
              update: { matchScore: Math.round(job.matchScore || 0) },
              create: {
                userId,
                jobId: job.jobId,
                matchScore: Math.round(job.matchScore || 0),
              },
            });
          }
        }

        // 2b. Update WorkflowRun status
        await tx.workflowRun.update({
          where: { requestId },
          data: {
            status: "completed",
            completedAt: new Date(),
            resultSummary: {
              totalMatches: matchedJobs?.length ?? 0,
              totalResumes: matchedJobs?.filter((j: any) => j.resumeUrl)?.length ?? 0,
              insights: insights ?? null,
            },
          },
        });
      },
      { timeout: 30000 }
    );

    console.log(`[receiveResults] Workflow ${requestId} marked completed`);
    return res.status(200).json({ success: true, message: "Results stored" });
  } catch (error) {
    console.error("[receiveResults] Error:", error);

    // Attempt to mark run as failed
    try {
      if (req.body.requestId) {
        await prisma.workflowRun.update({
          where: { requestId: req.body.requestId },
          data: {
            status: "failed",
            error: (error as Error).message,
          },
        });
      }
    } catch {
      // swallow — original error is more important
    }

    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/workflow/status/:userId
// Frontend polls this to check progress and fetch results
// ─────────────────────────────────────────────────────────────
export const getStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get the most recent workflow run
    const latestRun = await prisma.workflowRun.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" },
    });

    if (!latestRun) {
      return res.status(200).json({
        success: true,
        status: "idle",
        message: "No workflow has been triggered yet",
      });
    }

    // If completed, also fetch the actual results
    let results = null;
    if (latestRun.status === "completed") {
      const [matches, resumes] = await Promise.all([
        prisma.jobMatch.findMany({
          where: { userId },
          include: { job: true },
          orderBy: { matchScore: "desc" },
        }),
        prisma.tailoredResume.findMany({
          where: { userId },
          include: { job: true },
        }),
      ]);

      results = {
        matches: matches.map((m) => ({
          id: m.id,
          matchScore: m.matchScore,
          job: {
            id: m.job.id,
            title: m.job.title,
            company: m.job.company,
            location: m.job.location,
            description: m.job.description,
            link: m.job.link,
            postedAt: m.job.postedAt,
          },
        })),
        tailoredResumes: resumes.map((r) => ({
          id: r.id,
          resumeUrl: r.resumeUrl,
          job: {
            id: r.job.id,
            title: r.job.title,
            company: r.job.company,
          },
        })),
        summary: latestRun.resultSummary,
      };
    }

    return res.status(200).json({
      success: true,
      requestId: latestRun.requestId,
      status: latestRun.status,
      triggerType: latestRun.triggerType,
      startedAt: latestRun.startedAt,
      completedAt: latestRun.completedAt,
      error: latestRun.error,
      results,
    });
  } catch (error) {
    console.error("[getStatus] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// Shared helper — builds the COMPLETE payload sent to n8n webhook.
// Includes ALL user data relevant for resume generation,
// job matching, and profile representation.
// ─────────────────────────────────────────────────────────────
export function buildN8nPayload(requestId: string, user: any) {
  return {
    requestId,
    userId: user.id,
    callbackUrl: `${env.BACKEND_URL}/api/workflow/n8n-result`,
    user: {
      // ── Identity ─────────────────────────────────────────
      name: user.profile?.name ?? null,
      email: user.email,
      avatarUrl: user.profile?.avatarUrl ?? user.profile?.profileImageUrl ?? null,

      // ── Portfolio / social links ─────────────────────────
      githubUrl: user.portfolio?.githubUrl ?? null,
      linkedinUrl: user.portfolio?.linkedinUrl ?? null,
      websiteUrl: user.portfolio?.websiteUrl ?? null,

      // ── Professional summary ────────────────────────────
      summary: user.summary?.summaryText ?? null,
      primaryDomain: user.summary?.primaryDomain ?? null,

      // ── Skills ──────────────────────────────────────────
      skills: (user.skills ?? []).map((s: any) => ({
        name: s.name,
        domain: s.domain ?? null,
        source: s.source,
      })),

      // ── Work experience ────────────────────────────────
      experiences: (user.experiences ?? []).map((e: any) => ({
        role: e.role,
        company: e.company,
        startDate: e.startDate ?? null,
        endDate: e.endDate ?? null,
        description: e.description ?? null,
      })),

      // ── Projects ───────────────────────────────────────
      projects: (user.projects ?? []).map((p: any) => ({
        name: p.name,
        repoUrl: p.repoUrl,
        domain: p.domain ?? null,
        projectType: p.projectType,
        techStack: p.techStack ?? [],
        description: p.description ?? null,
        finalBullets: p.finalBullets ?? [],
      })),

      // ── Education ──────────────────────────────────────
      education: (user.educations ?? []).map((ed: any) => ({
        institution: ed.institution,
        degree: ed.degree ?? null,
        field: ed.field ?? null,
        startDate: ed.startDate ?? null,
        endDate: ed.endDate ?? null,
        gpa: ed.gpa ?? null,
      })),

      // ── Achievements / Awards ──────────────────────────
      achievements: (user.awards ?? []).map((a: any) => ({
        title: a.title,
        description: a.description ?? null,
        issuedAt: a.issuedAt ?? null,
      })),

      // ── Certifications ─────────────────────────────────
      certifications: (user.certifications ?? []).map((c: any) => ({
        name: c.name,
        issuer: c.issuer ?? null,
        issuedAt: c.issuedAt ?? null,
      })),
    },
    preferences: {
      primaryRole: user.jobPreferences.primaryRole,
      secondaryRoles: user.jobPreferences.secondaryRoles,
      workType: user.jobPreferences.workType,
      locations: user.jobPreferences.locations,
      minSalary: user.jobPreferences.minSalary,
      currency: user.jobPreferences.currency,
      experienceLevel: user.jobPreferences.experienceLevel,
      jobType: user.jobPreferences.jobType,
    },
  };
}

export const saveJobs = async (req: Request, res: Response) => {
  const { jobs } = req.body;

  if (!jobs || !Array.isArray(jobs)) {
    return res.status(400).json({ error: 'jobs array required' });
  }

  const results = await Promise.allSettled(
    jobs.map(job =>
      prisma.job.upsert({
        where: { link: job.link },
        update: {},
        create: {
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description ?? null,
          link: job.link,
          postedAt: job.postedAt ? new Date(job.postedAt) : new Date(),
        },
      })
    )
  );

  const saved = results.filter(r => r.status === 'fulfilled').length;
  const skipped = results.filter(r => r.status === 'rejected').length;

  res.json({ saved, skipped });
};

// ─────────────────────────────────────────────────────────────
// GET /api/workflow/my-matches
// Returns ALL job matches and tailored resumes for the user
// ─────────────────────────────────────────────────────────────
export const getMyMatches = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const [matches, resumes] = await Promise.all([
      prisma.jobMatch.findMany({
        where: { userId },
        include: { job: true },
        orderBy: { matchScore: "desc" },
      }),
      prisma.tailoredResume.findMany({
        where: { userId },
        include: { job: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return res.status(200).json({
      success: true,
      matches: matches.map((m) => ({
        id: m.id,
        matchScore: m.matchScore,
        semanticScore: m.semanticScore ?? null,
        matchMethod: m.matchMethod ?? "keyword",
        createdAt: m.createdAt,
        job: {
          id: m.job.id,
          title: m.job.title,
          company: m.job.company,
          location: m.job.location,
          description: m.job.description,
          link: m.job.link,
          postedAt: m.job.postedAt,
        },
      })),
      tailoredResumes: resumes.map((r) => ({
        id: r.id,
        resumeUrl: r.resumeUrl,
        atsScore: r.atsScore ?? null,
        iterations: r.iterations ?? 1,
        createdAt: r.createdAt,
        job: {
          id: r.job.id,
          title: r.job.title,
          company: r.job.company,
        },
      })),
      totalMatches: matches.length,
      totalResumes: resumes.length,
    });
  } catch (error) {
    console.error("[getMyMatches] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

