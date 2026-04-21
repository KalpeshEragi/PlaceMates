import type { ComponentType } from "react";
import PortfolioTemplate1 from "@/components/templates/portfolio/Template1";
import PortfolioTemplate2 from "@/components/templates/portfolio/Template2";
import PortfolioTemplate3 from "@/components/templates/portfolio/Template3";
import ResumeTemplate1 from "@/components/templates/resume/Template1";
import ResumeTemplate2 from "@/components/templates/resume/Template2";
import ArjunMehtaTemplate from "@/components/templates/resume/ArjunMehta";
import type { PortfolioData } from "@/components/templates/portfolio/Template1";
import type { ResumeData } from "@/components/templates/resume/Template1";

export type PortfolioTemplateId = "p1" | "p2" | "p3";
export type ResumeTemplateId = "r1" | "r2" | "arjun_mehta";

export const PORTFOLIO_TEMPLATES: Array<{
  id: PortfolioTemplateId;
  label: string;
  component: ComponentType<{ data: PortfolioData }>;
}> = [
  { id: "p1", label: "Developer Dark", component: PortfolioTemplate1 },
  { id: "p2", label: "Modern Clean", component: PortfolioTemplate2 },
  { id: "p3", label: "Creative Bold", component: PortfolioTemplate3 },
];

export const RESUME_TEMPLATES: Array<{
  id: ResumeTemplateId;
  label: string;
  component: ComponentType<{ data: ResumeData }>;
}> = [
  { id: "arjun_mehta", label: "Default", component: ArjunMehtaTemplate },
  { id: "r1", label: "ATS Clean", component: ResumeTemplate1 },
  { id: "r2", label: "Compact Pro", component: ResumeTemplate2 },
];

export function portfolioComponentForId(
  id: string | null | undefined,
): (typeof PORTFOLIO_TEMPLATES)[number]["component"] {
  const row = PORTFOLIO_TEMPLATES.find((t) => t.id === id);
  return row?.component ?? PortfolioTemplate1;
}

export function resumeComponentForId(
  id: string | null | undefined,
): (typeof RESUME_TEMPLATES)[number]["component"] {
  const row = RESUME_TEMPLATES.find((t) => t.id === id);
  return row?.component ?? ResumeTemplate1;
}
