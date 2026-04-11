import { Router } from "express";
import { getPublicPortfolio } from "../controllers/portfolioPublicController";

const portfolioPublicRouter = Router();

// GET /api/portfolio/:slug — public, no auth required
portfolioPublicRouter.get("/:slug", getPublicPortfolio);

export default portfolioPublicRouter;
