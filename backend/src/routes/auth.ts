import { Router } from "express";
import passport from "../config/passport";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { env } from "../config/env";
import { githubCallback, startGithubOAuth } from "../controllers/authController";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/Authentication?error=oauth_failed`,
  }),
  (req: any, res) => {
    const token = jwt.sign({ userId: req.user.id }, env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.redirect(`${env.FRONTEND_URL}/auth-success?token=${token}`);
  }
);

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.userAuth.findUnique({
    where: { id: req.userId },
    include: {
      profile: true,
      oauth: {
        select: { provider: true, providerUserId: true },
      },
    },
  });

  res.json(user);
});

router.get("/github", requireAuth, startGithubOAuth);
router.get("/github/callback", githubCallback);

export default router;
