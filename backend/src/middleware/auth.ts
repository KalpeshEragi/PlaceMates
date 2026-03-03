import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1] || req.headers.authorization;
  } else if (req.query.token) {
    token = req.query.token as string;
  } else if (req.headers.cookie) {
    const tokenCookie = req.headers.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("token="));

    if (tokenCookie) {
      token = decodeURIComponent(tokenCookie.split("=")[1] || "");
    }
  }

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };

    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
