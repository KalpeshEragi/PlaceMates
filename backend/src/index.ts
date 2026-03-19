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

import portfolioRoutes from "./routes/portfolioRoutes.js";
import publicPortfolioRoutes from "./routes/publicPortfolioRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(passport.initialize());

// ── Routes ────────────────────────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/linkedin", linkedinRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/github", githubRouter);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/public", publicPortfolioRoutes);
app.use("/api/resume", resumeRoutes);

// ── Error handler (must be last) ──────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
app.listen(env.PORT, () => {
    console.log(`🚀 PlaceMates API running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
});

export default app;