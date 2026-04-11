/**
 * authController.ts
 *
 * Handles:
 *   GET /api/auth/me           — return current user profile
 *   GET /api/auth/github       — start GitHub OAuth flow
 *   GET /api/auth/github/callback — handle GitHub OAuth callback
 */

import type { Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import type { AuthRequest } from "../middleware/auth";
import { advanceStage } from "../middleware/onboardingGuard";
import { syncUserGithubRepos } from "../services/githubService";

function githubRedirectUri(): string {
  return (
    env.GITHUB_REDIRECT_URI ||
    `${env.BACKEND_URL || `http://localhost:${env.PORT}`}/api/auth/github/callback`
  );
}

// ─── GET /api/auth/me ────────────────────────────────────────

export async function getMe(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.userAuth.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      onboardingStage: true,
      githubConnected: true,
      githubLogin: true,
      linkedinImported: true,
      createdAt: true,
      profile: {
        select: { name: true, avatarUrl: true },
      },
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  return res.json(user);
}

// ─── GET /api/auth/github ────────────────────────────────────

export function startGithubOAuth(req: AuthRequest, res: Response) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  if (!env.GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: "GitHub OAuth is not configured" });
  }

  const state = jwt.sign(
    { userId: req.userId, type: "github_oauth_state" },
    env.JWT_SECRET,
    { expiresIn: "10m" },
  );

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: githubRedirectUri(),
    scope: "read:user repo",
    state,
  });

  return res.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  );
}

// ─── GET /api/auth/github/callback ───────────────────────────

export async function githubCallback(req: Request, res: Response) {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state) {
    return res.redirect(`${env.FRONTEND_URL}/dashboard?error=missing_oauth_params`);
  }

  let userId: string;
  try {
    const decoded = jwt.verify(state, env.JWT_SECRET) as {
      userId?: string;
      type?: string;
    };
    if (!decoded.userId || decoded.type !== "github_oauth_state") {
      return res.redirect(`${env.FRONTEND_URL}/dashboard?error=invalid_state`);
    }
    userId = decoded.userId;
  } catch {
    return res.redirect(`${env.FRONTEND_URL}/dashboard?error=invalid_state`);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return res.redirect(`${env.FRONTEND_URL}/dashboard?error=oauth_not_configured`);
  }

  try {
    const tokenRes = await axios.post<{ access_token?: string }>(
      "https://github.com/login/oauth/access_token",
      {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: githubRedirectUri(),
      },
      { headers: { Accept: "application/json" } },
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      return res.redirect(`${env.FRONTEND_URL}/dashboard?error=token_exchange_failed`);
    }

    await prisma.userAuth.update({
      where: { id: userId },
      data: { githubConnected: true, githubAccessToken: accessToken },
    });

    await advanceStage(userId, "github_connected");

    // Kick off repo sync immediately in the background so repos are ready
    syncUserGithubRepos(userId).catch((err) =>
      console.error("[GitHub OAuth] Background sync failed:", err),
    );

    return res.redirect(`${env.FRONTEND_URL}/onboarding?github=connected`);
  } catch (error) {
    console.error("[GitHub OAuth] Callback failed:", error);
    return res.redirect(`${env.FRONTEND_URL}/dashboard?error=github_oauth_failed`);
  }
}