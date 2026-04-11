import { Request, Response } from "express";
import { prisma } from "../lib/prisma"; // adjust to your prisma import path

const VALID_WORK_TYPES = ["Remote", "Onsite", "Hybrid"] as const;
const VALID_EXPERIENCE_LEVELS = ["Fresher", "0–2 years", "2–5 years", "5+ years"] as const;
const VALID_JOB_TYPES = ["Internship", "Full-time", "Contract"] as const;
const VALID_CURRENCIES = ["INR", "USD"] as const;

// ─────────────────────────────────────────────────────────────
// GET /job-preferences
// ─────────────────────────────────────────────────────────────
export const getJobPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;

    const preferences = await prisma.jobPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return res.status(404).json({ success: false, message: "No preferences found" });
    }

    return res.status(200).json({ success: true, data: preferences });
  } catch (error) {
    console.error("[getJobPreferences] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /job-preferences  (create or update)
// ─────────────────────────────────────────────────────────────
export const createOrUpdateJobPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;

    const {
      primaryRole,
      secondaryRoles,
      workType,
      locations,
      minSalary,
      currency,
      experienceLevel,
      jobType,
    } = req.body;

    // ── Validation ──────────────────────────────────────────
    if (!primaryRole || typeof primaryRole !== "string" || !primaryRole.trim()) {
      return res.status(400).json({ success: false, message: "primaryRole is required" });
    }

    if (!VALID_WORK_TYPES.includes(workType)) {
      return res.status(400).json({
        success: false,
        message: `workType must be one of: ${VALID_WORK_TYPES.join(", ")}`,
      });
    }

    if (!VALID_EXPERIENCE_LEVELS.includes(experienceLevel)) {
      return res.status(400).json({
        success: false,
        message: `experienceLevel must be one of: ${VALID_EXPERIENCE_LEVELS.join(", ")}`,
      });
    }

    if (!VALID_JOB_TYPES.includes(jobType)) {
      return res.status(400).json({
        success: false,
        message: `jobType must be one of: ${VALID_JOB_TYPES.join(", ")}`,
      });
    }

    if (typeof minSalary !== "number" || isNaN(minSalary) || minSalary < 0) {
      return res.status(400).json({ success: false, message: "minSalary must be a non-negative number" });
    }

    if (currency && !VALID_CURRENCIES.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: `currency must be one of: ${VALID_CURRENCIES.join(", ")}`,
      });
    }

    // ── Upsert ──────────────────────────────────────────────
    const payload = {
      primaryRole: primaryRole.trim(),
      secondaryRoles: Array.isArray(secondaryRoles) ? secondaryRoles : [],
      workType,
      locations: Array.isArray(locations) ? locations : [],
      minSalary,
      currency: currency || "INR",
      experienceLevel,
      jobType,
    };

    const preferences = await prisma.jobPreferences.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload },
    });

    return res.status(200).json({ success: true, data: preferences });
  } catch (error) {
    console.error("[createOrUpdateJobPreferences] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};