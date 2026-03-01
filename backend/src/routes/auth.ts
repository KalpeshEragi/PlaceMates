import { Router } from "express";
import passport from "../config/passport";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// ── Google OAuth ──────────────────────────────────────────
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/Authentication?error=oauth_failed` }),
  (req: any, res) => {
    const token = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/auth-success?token=${token}`);
  }
);

// ── Current user ──────────────────────────────────────────
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

// ── GitHub OAuth (account linking) ────────────────────────
router.get(
  "/github",
  (req, res, next) => {
    // ⭐ Accept JWT token from query string and pass as OAuth state
    const token = req.query.token as string;
    passport.authenticate("github", {
      state: token || undefined,
    })(req, res, next);
  }
);

router.get(
  "/github/callback",
  (req, res, next) => {
    // ⭐ Restore JWT from state before Passport processes the callback
    const token = req.query.state as string;
    if (token) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        (req as any).userId = decoded.userId;
      } catch {
        return res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard?error=invalid_token`
        );
      }
    }
    next();
  },
  passport.authenticate("github", { session: false }),
  (_req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/github-success`);
  }
);

export default router;