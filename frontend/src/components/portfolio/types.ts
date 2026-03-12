export type PortfolioProfile = {
  name?: string | null;
  title?: string | null;
  tagline?: string | null;
  photo?: string | null;
  profilePhoto?: string | null;
  profilePhotoUrl?: string | null;
  email?: string | null;
  github?: string | null;
  linkedin?: string | null;
  website?: string | null;
};

export type PortfolioCareer = {
  primaryDomain?: string | null;
  secondaryDomain?: string | null;
  technicalOrientation?: string | null;
  experienceYears?: number | null;
  careerSummary?: string | null;
  aiTitle?: string | null;
  tagline?: string | null;
};

export type PortfolioSkill = {
  name: string;
  frequency?: number | null;
  cluster?: string | null;
  score?: number | null;
  strength?: number | null;
};

export type PortfolioProject = {
  name: string;
  description?: string | null;
  repoUrl?: string | null;
  url?: string | null;
  stars?: number | null;
  domain?: string | null;
  detectedDomain?: string | null;
  finalScore?: number | null;
  score?: number | null;
  language?: string | null;
};

export type PortfolioExperienceItem = {
  start?: string | null;
  end?: string | null;
  date?: string | null;
  role?: string | null;
  title?: string | null;
  organization?: string | null;
  company?: string | null;
  description?: string | null;
};

export type PortfolioEvolutionStage = {
  year?: string | number | null;
  label: string;
  domains?: string[];
  projects?: string[];
  technologies?: string[];
};

export type PortfolioAchievement = {
  title: string;
  issuer?: string | null;
  year?: string | number | null;
};

export type PortfolioStats = {
  profileScore?: number | null;
  leadershipScore?: number | null;
  impactScore?: number | null;
  ownershipScore?: number | null;
};

export type PortfolioDomains = {
  primaryDomain?: string | null;
  secondaryDomain?: string | null;
  technicalOrientation?: string | null;
};

export type GithubSkillSignal = {
  name: string;
  strength: number;
  source?: string | null;
};

export type RepoLanguageInfo = {
  language?: string | null;
  locByLanguage?: Record<string, number> | null;
  description?: string | null;
  readmeSummary?: string | null;
};

export type PortfolioResponse = {
  profile?: PortfolioProfile;
  career?: PortfolioCareer;
  skills?: PortfolioSkill[];
  projects?: PortfolioProject[];
  experience?: PortfolioExperienceItem[];
  evolution?: PortfolioEvolutionStage[];
  achievements?: PortfolioAchievement[];
  domains?: PortfolioDomains;
  stats?: PortfolioStats;
  githubSkills?: GithubSkillSignal[];
  repoLanguages?: RepoLanguageInfo[];
};

