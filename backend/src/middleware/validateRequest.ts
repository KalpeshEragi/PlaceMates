import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/**
 * Validates the n8n callback using a shared secret header.
 * n8n must send:  x-n8n-secret: <shared_secret>
 *
 * If N8N_WEBHOOK_SECRET is not configured, validation is skipped
 * (development convenience — always set in production).
 */
export function validateN8nCallback(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const secret = req.headers["x-n8n-secret"] as string;

  if (!env.N8N_WEBHOOK_SECRET) {
    console.warn(
      "[validateN8nCallback] N8N_WEBHOOK_SECRET not configured — skipping validation"
    );
    return next();
  }

  if (!secret || secret !== env.N8N_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Invalid or missing n8n secret" });
  }

  next();
}

/**
 * Generic request body validator factory.
 * Usage: router.post("/route", validateBody(["field1", "field2"]), handler)
 */
export function validateBody(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = requiredFields.filter((f) => req.body[f] === undefined);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(", ")}`,
      });
    }
    next();
  };
}
