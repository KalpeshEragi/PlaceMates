import type { Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import type { AuthRequest } from "../middleware/auth";
import { advanceStage } from "../middleware/onboardingGuard";

function getGithubRedirectUri(): string {
  return (
    env.GITHUB_REDIRECT_URI ||
    `${env.BACKEND_URL || `http://localhost:${env.PORT}`}/api/auth/github/callback`
  );
}

export function startGithubOAuth(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!env.GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: "GitHub OAuth is not configured" });
  }

  const state = jwt.sign(
    { userId: req.userId, type: "github_oauth_state" },
    env.JWT_SECRET,
    { expiresIn: "10m" }
  );

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: getGithubRedirectUri(),
    scope: "read:user repo",
    state,
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

export async function githubCallback(req: AuthRequest, res: Response) {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state) {
    return res.redirect(`${env.FRONTEND_URL}/connect-accounts?error=missing_oauth_params`);
  }

  let userId: string;
  try {
    const decoded = jwt.verify(state, env.JWT_SECRET) as { userId?: string; type?: string };
    if (!decoded.userId || decoded.type !== "github_oauth_state") {
      return res.redirect(`${env.FRONTEND_URL}/connect-accounts?error=invalid_state`);
    }
    userId = decoded.userId;
  } catch {
    return res.redirect(`${env.FRONTEND_URL}/connect-accounts?error=invalid_state`);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return res.redirect(`${env.FRONTEND_URL}/connect-accounts?error=oauth_not_configured`);
  }

  try {
    const tokenRes = await axios.post<{ access_token?: string }>(
      "https://github.com/login/oauth/access_token",
      {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: getGithubRedirectUri(),
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      return res.redirect(`${env.FRONTEND_URL}/connect-accounts?error=token_exchange_failed`);
    }

    await prisma.userAuth.update({
      where: { id: userId },
      data: {
        githubConnected: true,
        githubAccessToken: accessToken,
      },
    });
    await advanceStage(userId, "github_connected");

    return res.redirect(`${env.FRONTEND_URL}/connect-accounts?github=connected`);
  } catch (error) {
    console.error("GitHub OAuth callback failed:", error);
    return res.redirect(`${env.FRONTEND_URL}/connect-accounts?error=github_oauth_failed`);
  }
}
