import { Response } from "express";
import { randomUUID } from "crypto";
import axios from "axios";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import type { AuthRequest } from "../middleware/auth";

// ─────────────────────────────────────────────────────────────
// POST /api/jobs/trigger-matching
// Called by the frontend to start the n8n job matching workflow
// ─────────────────────────────────────────────────────────────
export const triggerMatching = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // 1. Abandon any existing pending/processing runs for this user
    await prisma.workflowRun.updateMany({
      where: { userId, status: { in: ["pending", "processing"] } },
      data: { status: "failed", error: "Abandoned by new manual trigger" },
    });

    // 2. Create WorkflowRun record
    const requestId = randomUUID();
    await prisma.workflowRun.create({
      data: {
        userId,
        requestId,
        triggerType: "manual",
        status: "pending",
      },
    });

    // 3. Trigger n8n single-user webhook
    const n8nWebhookUrl = env.N8N_SINGLE_USER_WEBHOOK_URL || env.N8N_WEBHOOK_URL;
    axios
      .post(
        n8nWebhookUrl,
        {
          requestId,
          userId,
          callbackUrl: `${env.BACKEND_URL}/api/internal/n8n-callback`,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.N8N_API_KEY || "",
          },
          timeout: 10000,
        }
      )
      .then(() => {
        console.log(`[triggerMatching] n8n single-user triggered for userId=${userId}, requestId=${requestId}`);
      })
      .catch(async (err) => {
        console.error(
          `[triggerMatching] n8n trigger failed for requestId=${requestId}:`,
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

    // 4. Return immediately
    return res.status(202).json({
      success: true,
      requestId,
      status: "pending",
    });
  } catch (error) {
    console.error("[triggerMatching] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
