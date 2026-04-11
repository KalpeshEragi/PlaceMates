import { Router } from "express";
import passport from "../config/passport";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth";
import { env } from "../config/env";
import { getMe, startGithubOAuth, githubCallback } from "../controllers/authController";
import type { AuthRequest } from "../middleware/auth";
 
const authRouter = Router();
 
// Google OAuth
authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
 
authRouter.get(
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
  },
);
 
// Current user
authRouter.get("/me", requireAuth, getMe);
 
// GitHub OAuth
authRouter.get("/github", requireAuth, startGithubOAuth);
authRouter.get("/github/callback", githubCallback);
 
export default authRouter;