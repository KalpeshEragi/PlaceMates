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
import projectsRouter from "./routes/projects.js";
import userRouter from "./routes/user.js";
import portfolioPublicRouter from "./routes/portfolioPublic.js";
import profileRouter from "./routes/profile.js";
import uploadRouter from "./routes/upload.js";
import jobPreferencesRouter from "./routes/jobPreferences.js";
import workflowRouter from "./routes/workflow.js";
import internalRouter from "./routes/internal.js";
import jobsRouter from "./routes/jobs.js";
import evaluationRouter from "./routes/evaluation.js";
import { startScheduler } from "./services/scheduler.js";

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
app.use("/api/projects", projectsRouter);
app.use("/api/user", userRouter);
app.use("/api/portfolio", portfolioPublicRouter);
app.use("/api/profile", profileRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/job-preferences", jobPreferencesRouter);
app.use("/api/workflow", workflowRouter);
app.use("/api/internal", internalRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/evaluation", evaluationRouter);

// ── Error handler (must be last) ──────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
app.listen(env.PORT, () => {
    console.log(`🚀 PlaceMates API running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    startScheduler();
});

export default app;