import { Request, Response, NextFunction } from "express";

/**
 * Validates internal API calls using the X-API-Key header.
 * Used by n8n and other internal services to call backend endpoints.
 *
 * Expects:  X-API-Key: <INTERNAL_API_KEY>
 *
 * If INTERNAL_API_KEY is not configured, validation is skipped
 * (development convenience — always set in production).
 */
export function validateInternalApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"] as string;
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    console.warn(
      "[validateInternalApiKey] INTERNAL_API_KEY not configured — skipping validation"
    );
    return next();
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}
