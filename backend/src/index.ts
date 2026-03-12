import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";

import passport from "./config/passport.js";
import authRouter from "./routes/auth.js";
import linkedinRouter from "./routes/linkedin.js";
import integrationsRouter from "./routes/integrations.js";
import githubRouter from "./routes/github.js";
import portfolioRouter from "./routes/portfolioRoutes.js";
import publicPortfolioRouter from "./routes/publicPortfolioRoutes.js";
import resumeRouter from "./routes/resumeRoutes.js";

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ── Routes ────────────────────────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/linkedin", linkedinRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/github", githubRouter);
app.use("/api/portfolio", publicPortfolioRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/resume", resumeRouter);

// ── Error handler (must be last) ──────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
app.listen(env.PORT, () => {
    console.log(`🚀 PlaceMates API running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
});

export default app;